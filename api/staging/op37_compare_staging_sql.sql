-- OP-37: repeatable measured SQL benchmark on private synthetic Supabase staging only.
-- No API grants, no external accounts, no changes to public schema.
CREATE OR REPLACE FUNCTION op37_sondaggi_ci.compare_sql_modes_ci(sample_runs integer DEFAULT 6)
RETURNS TABLE (
  scope_name text, synthetic_accounts integer, published_opinions integer,
  legacy_query_count integer, grouped_query_count integer,
  legacy_p50_ms numeric, grouped_p50_ms numeric,
  legacy_p95_ms numeric, grouped_p95_ms numeric,
  payloads_equal boolean, boundary_voters integer, simulated_revocation_voters integer
)
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, op37_sondaggi_ci
AS $BODY$
DECLARE
  area record;
  question record;
  counts record;
  v_ids text[];
  v_values text;
  v_sql text;
  v_geo text;
  v_old jsonb;
  v_new jsonb;
  v_start timestamptz;
  v_ms numeric;
  v_old_times numeric[];
  v_new_times numeric[];
  v_trial integer;
  v_case integer;
  v_mode text;
  v_total bigint;
  v_boundary integer;
  v_revoked integer;
  v_question_count integer;
  v_account_count integer;
BEGIN
  IF sample_runs < 3 OR sample_runs > 12 THEN
    RAISE EXCEPTION 'Only 3..12 synthetic benchmark repetitions permitted';
  END IF;

  SELECT COUNT(*)::integer INTO v_account_count FROM op37_sondaggi_ci.users;
  IF v_account_count <> 1200 THEN
    RAISE EXCEPTION 'Synthetic fixture count changed; no benchmarks permitted';
  END IF;
  SELECT array_agg(q.id ORDER BY q.text), COUNT(*)::integer
    INTO v_ids,v_question_count
  FROM op37_sondaggi_ci.opinioni_domande q
  WHERE NOT ('da approvare'=ANY(q.gradi_opinione));
  IF v_question_count<>93 THEN
    RAISE EXCEPTION 'Synthetic question fixture changed';
  END IF;
  SELECT string_agg(format('(%L,orr.%I)',q.id,q.id),',' ORDER BY q.text)
    INTO v_values
  FROM op37_sondaggi_ci.opinioni_domande q
  WHERE NOT ('da approvare'=ANY(q.gradi_opinione));

  FOR area IN SELECT * FROM (VALUES
    ('national'::text,''::text),
    ('region', 'AND u.regione_residenza = ''TO'''),
    ('province', 'AND u.regione_residenza = ''TO'' AND u.provincia_residenza = ''PI'''),
    ('municipality','AND u.regione_residenza = ''TO'' AND u.provincia_residenza = ''PI'' AND u.comune_residenza = ''Pisa''')
  ) AS places(name,geo)
  LOOP
    v_geo := area.geo;
    v_old_times:=ARRAY[]::numeric[];
    v_new_times:=ARRAY[]::numeric[];
    v_sql :=
      'SELECT v.opinion_id,'||
      'COUNT(*) FILTER (WHERE v.answer=''f'')::integer AS favorevole,'||
      'COUNT(*) FILTER (WHERE v.answer=''c'')::integer AS contrario,'||
      'COUNT(*) FILTER (WHERE v.answer=''i'')::integer AS indeciso '||
      'FROM op37_sondaggi_ci.opinioni_risposte orr '||
      'JOIN op37_sondaggi_ci.users u ON u.id=orr.user_id '||
      'LEFT JOIN op37_sondaggi_ci.user_consents uc ON uc.user_id=u.id '||
      'CROSS JOIN LATERAL (VALUES '||v_values||') v(opinion_id,answer) '||
      'WHERE v.answer IS NOT NULL AND u.account_type=''PERSON'' '||
      'AND COALESCE(uc.political_opinions_consent,u.political_opinions_consent,false) IS TRUE '||
      v_geo||' GROUP BY v.opinion_id';
    FOR v_trial IN 0..sample_runs LOOP
      FOR v_case IN 1..2 LOOP
        -- Alternate ABBA order; first trial is warmup and not recorded.
        v_mode := CASE
          WHEN mod(v_trial+v_case,2)=0 THEN 'legacy' ELSE 'grouped'
        END;
        v_start:=clock_timestamp();
        IF v_mode='legacy' THEN
          v_old:='{}'::jsonb;
          -- The FOR query is the single catalog read in the legacy path.
          -- A separate PERFORM here would count one extra catalog scan.
          FOR question IN
            SELECT q.id FROM op37_sondaggi_ci.opinioni_domande q
            WHERE NOT ('da approvare'=ANY(q.gradi_opinione)) ORDER BY q.text
          LOOP
            PERFORM 1 FROM information_schema.columns
             WHERE table_schema='op37_sondaggi_ci'
               AND table_name='opinioni_risposte'
               AND column_name=question.id;
            IF NOT FOUND THEN
              RAISE EXCEPTION 'Expected opinion column missing: %',question.id;
            END IF;
            EXECUTE
              'SELECT COUNT(*) FILTER (WHERE orr.'||quote_ident(question.id)||'=''f'')::integer AS favorevole,'||
              'COUNT(*) FILTER (WHERE orr.'||quote_ident(question.id)||'=''c'')::integer AS contrario,'||
              'COUNT(*) FILTER (WHERE orr.'||quote_ident(question.id)||'=''i'')::integer AS indeciso '||
              'FROM op37_sondaggi_ci.opinioni_risposte orr '||
              'JOIN op37_sondaggi_ci.users u ON u.id=orr.user_id '||
              'LEFT JOIN op37_sondaggi_ci.user_consents uc ON uc.user_id=u.id '||
              'WHERE orr.'||quote_ident(question.id)||' IS NOT NULL '||
              'AND u.account_type=''PERSON'' '||
              'AND COALESCE(uc.political_opinions_consent,u.political_opinions_consent,false) IS TRUE '||v_geo
            INTO counts;
            IF counts.favorevole+counts.contrario+counts.indeciso>=10 THEN
              v_old:=v_old || jsonb_build_object(question.id,
                jsonb_build_array(counts.favorevole,counts.contrario,counts.indeciso));
            END IF;
          END LOOP;
        ELSE
          v_new:='{}'::jsonb;
          PERFORM q.id FROM op37_sondaggi_ci.opinioni_domande q
            WHERE NOT ('da approvare'=ANY(q.gradi_opinione)) ORDER BY q.text;
          PERFORM c.column_name FROM information_schema.columns c
            WHERE c.table_schema='op37_sondaggi_ci'
              AND c.table_name='opinioni_risposte'
              AND c.column_name=ANY(v_ids);
          FOR counts IN EXECUTE v_sql LOOP
            IF counts.favorevole+counts.contrario+counts.indeciso>=10 THEN
              v_new:=v_new || jsonb_build_object(counts.opinion_id,
                jsonb_build_array(counts.favorevole,counts.contrario,counts.indeciso));
            END IF;
          END LOOP;
        END IF;
        v_ms:=extract(epoch from (clock_timestamp()-v_start))*1000;
        IF v_trial>0 THEN
          IF v_mode='legacy' THEN
            v_old_times:=array_append(v_old_times,v_ms);
          ELSE
            v_new_times:=array_append(v_new_times,v_ms);
          END IF;
        END IF;
      END LOOP;
      IF v_old IS DISTINCT FROM v_new THEN
        RAISE EXCEPTION 'Legacy/grouped publication mismatch in scope %',area.name;
      END IF;
    END LOOP;

    -- Exactly ten consenting synthetic PERSON answers for slot 093.
    -- Simulate a revocation as an extra predicate; NEVER update data.
    EXECUTE 'SELECT count(*)::integer FROM op37_sondaggi_ci.users u '||
      'JOIN op37_sondaggi_ci.opinioni_risposte a ON a.user_id=u.id '||
      'LEFT JOIN op37_sondaggi_ci.user_consents uc ON uc.user_id=u.id '||
      'WHERE a.synthetic_opinion_093=''f'' AND u.account_type=''PERSON'' '||
      'AND COALESCE(uc.political_opinions_consent,u.political_opinions_consent,false) IS TRUE '||v_geo
    INTO v_boundary;
    EXECUTE 'SELECT count(*)::integer FROM op37_sondaggi_ci.users u '||
      'JOIN op37_sondaggi_ci.opinioni_risposte a ON a.user_id=u.id '||
      'LEFT JOIN op37_sondaggi_ci.user_consents uc ON uc.user_id=u.id '||
      'WHERE a.synthetic_opinion_093=''f'' AND u.account_type=''PERSON'' '||
      'AND COALESCE(uc.political_opinions_consent,u.political_opinions_consent,false) IS TRUE '||
      'AND u.id<>''00000000-0000-4000-8000-000000000001''::uuid '||v_geo
    INTO v_revoked;
    IF v_boundary<>10 OR v_revoked<>9 THEN
      RAISE EXCEPTION 'Synthetic ten-to-nine privacy boundary broken: % / %',v_boundary,v_revoked;
    END IF;
    scope_name:=area.name;
    synthetic_accounts:=v_account_count;
    published_opinions:=v_question_count;
    legacy_query_count:=187;
    grouped_query_count:=3;
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY t)
      INTO legacy_p50_ms FROM unnest(v_old_times) t;
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY t)
      INTO grouped_p50_ms FROM unnest(v_new_times) t;
    SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY t)
      INTO legacy_p95_ms FROM unnest(v_old_times) t;
    SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY t)
      INTO grouped_p95_ms FROM unnest(v_new_times) t;
    legacy_p50_ms:=round(legacy_p50_ms,3);
    grouped_p50_ms:=round(grouped_p50_ms,3);
    legacy_p95_ms:=round(legacy_p95_ms,3);
    grouped_p95_ms:=round(grouped_p95_ms,3);
    payloads_equal:=true;
    boundary_voters:=v_boundary;
    simulated_revocation_voters:=v_revoked;
    RETURN NEXT;
  END LOOP;
END;
$BODY$;

REVOKE ALL ON FUNCTION op37_sondaggi_ci.compare_sql_modes_ci(integer)
 FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON FUNCTION op37_sondaggi_ci.compare_sql_modes_ci(integer)
 IS 'For OP-37: server-side only, synthetic private Supabase staging schema, 3..12 repeats, no data writes';
