-- DEMOS provincial representatives (#627): staging-only, metadata-only preflight.
-- Run by an authorized operator in Demos-Staging (project fkeayjzvtuvzesljhjbc).
-- This script never queries application rows and never changes privileges,
-- policies, schema, data, credentials or environment variables.
-- It is NOT a staging GO: a declared RLS policy can still deny all rows.
-- Column inventory covers the core provincial E2E path, not every app route.
-- For canonical political choices, verify an actual unique ON CONFLICT key
-- (user_id, selection_kind, political_office_id); the legacy PK differs.
-- The canonical selection route also needs INSERT/UPDATE/DELETE privileges and
-- corresponding RLS policies; policy presence is NOT proof of effective access.
WITH required (relation_name, mandatory_for_e2e, purpose) AS (
  VALUES
    ('users', true, 'residence/consent'),
    ('user_consents', true, 'current consent'),
    ('political_selections', true, 'canonical selection'),
    ('political_mandates', true, 'provincial representatives'),
    ('political_candidacies', true, 'provincial candidates'),
    ('eventi', true, 'candidate election event'),
    ('unita_elettorale', true, 'candidate electoral unit'),
    ('unita_elettorale_territorio', true, 'candidate unit territory'),
    ('user_political_territories', false, 'canonical residence (legacy fallback exists)'),
    ('user_electoral_unit_memberships', false, 'canonical electoral membership (legacy fallback exists)')
),
required_columns (relation_name, column_name) AS (
  VALUES
    ('users', 'id'),
    ('users', 'nome'),
    ('users', 'cognome'),
    ('users', 'ruolo'),
    ('users', 'status'),
    ('users', 'paese_residenza'),
    ('users', 'regione_residenza'),
    ('users', 'provincia_residenza'),
    ('users', 'comune_residenza'),
    ('user_consents', 'user_id'),
    ('user_consents', 'political_opinions_consent'),
    ('political_selections', 'user_id'),
    ('political_selections', 'selection_kind'),
    ('political_selections', 'jurisdiction_id'),
    ('political_selections', 'political_office_id'),
    ('political_selections', 'selected_user_id'),
    ('political_selections', 'selected_candidacy_id'),
    ('political_selections', 'selected_mandate_id'),
    ('political_selections', 'source'),
    ('political_selections', 'context'),
    ('political_selections', 'updated_at'),
    ('political_mandates', 'id'),
    ('political_mandates', 'user_id'),
    ('political_mandates', 'office_code'),
    ('political_mandates', 'jurisdiction'),
    ('political_mandates', 'status'),
    ('political_mandates', 'starts_at'),
    ('political_mandates', 'ends_at'),
    ('political_candidacies', 'id'),
    ('political_candidacies', 'user_id'),
    ('political_candidacies', 'election_event_id'),
    ('political_candidacies', 'electoral_unit_id'),
    ('political_candidacies', 'jurisdiction'),
    ('political_candidacies', 'status'),
    ('political_candidacies', 'starts_at'),
    ('political_candidacies', 'ends_at'),
    ('eventi', 'id'),
    ('eventi', 'tipologia_evento'),
    ('eventi', 'giorno_inizio'),
    ('eventi', 'giorno_fine'),
    ('unita_elettorale', 'id'),
    ('unita_elettorale', 'evento_id'),
    ('unita_elettorale_territorio', 'unita_elettorale_id'),
    ('unita_elettorale_territorio', 'territory_type'),
    ('unita_elettorale_territorio', 'territory_code'),
    ('unita_elettorale_territorio', 'regione_codice')
),
inventory AS (
  SELECT r.relation_name, r.mandatory_for_e2e, r.purpose,
         c.oid AS relation_oid,
         ARRAY(
           SELECT rc.column_name
           FROM required_columns rc
           LEFT JOIN pg_catalog.pg_attribute a
             ON a.attrelid = c.oid AND a.attname = rc.column_name
            AND a.attnum > 0 AND NOT a.attisdropped
           WHERE rc.relation_name = r.relation_name AND a.attnum IS NULL
           ORDER BY rc.column_name
         ) AS missing_columns,
         CASE WHEN r.relation_name = 'political_selections' THEN EXISTS (
           SELECT 1 FROM pg_catalog.pg_index i
           WHERE i.indrelid = c.oid AND i.indisunique AND i.indisvalid
             AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
             AND i.indnkeyatts = 3
             AND (
               SELECT array_agg(a.attname ORDER BY a.attname)
               FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, key_position)
               JOIN pg_catalog.pg_attribute a
                 ON a.attrelid = i.indrelid AND a.attnum = k.attnum
               WHERE k.key_position <= i.indnkeyatts
             ) = ARRAY['political_office_id', 'selection_kind', 'user_id']::name[]
         ) ELSE NULL END AS canonical_selection_unique_key_ready,
         -- Legacy PRIMARY KEY blocks selecting the same person for two offices.
         -- Adding the canonical conflict key alone would leave that blocker.
         CASE WHEN r.relation_name = 'political_selections' THEN EXISTS (
           SELECT 1 FROM pg_catalog.pg_index i
           WHERE i.indrelid = c.oid AND i.indisunique AND i.indisvalid
             AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
             AND i.indnkeyatts = 3
             AND (
               SELECT array_agg(a.attname ORDER BY a.attname)
               FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, key_position)
               JOIN pg_catalog.pg_attribute a
                 ON a.attrelid = i.indrelid AND a.attnum = k.attnum
               WHERE k.key_position <= i.indnkeyatts
             ) = ARRAY['selected_user_id', 'selection_kind', 'user_id']::name[]
         ) ELSE NULL END AS legacy_selection_unique_key_conflict,
         -- Incoming foreign keys must be reviewed before replacing the
         -- legacy primary key. Metadata only: never inspect selected people.
         CASE WHEN r.relation_name = 'political_selections' THEN EXISTS (
           SELECT 1 FROM pg_catalog.pg_constraint fk
           WHERE fk.contype = 'f' AND fk.confrelid = c.oid
         ) ELSE NULL END AS selection_has_incoming_foreign_keys,
         COALESCE(c.relrowsecurity, false) AS rls_enabled,
         CASE WHEN c.oid IS NULL THEN false
           ELSE has_table_privilege('demos_staging_runtime', c.oid, 'SELECT')
         END AS runtime_can_select,
         CASE WHEN c.oid IS NULL THEN false
           ELSE has_table_privilege('demos_staging_runtime', c.oid, 'INSERT')
         END AS runtime_can_insert,
         CASE WHEN c.oid IS NULL THEN false
           ELSE has_table_privilege('demos_staging_runtime', c.oid, 'UPDATE')
         END AS runtime_can_update,
         CASE WHEN c.oid IS NULL THEN false
           ELSE has_table_privilege('demos_staging_runtime', c.oid, 'DELETE')
         END AS runtime_can_delete,
         EXISTS (
           SELECT 1 FROM pg_catalog.pg_policy p
           WHERE p.polrelid = c.oid
             AND p.polcmd IN ('r', '*')
             AND (0 = ANY(p.polroles)
                  OR 'demos_staging_runtime'::regrole::oid = ANY(p.polroles))
         ) AS runtime_read_policy_declared,
         CASE WHEN r.relation_name = 'political_selections' THEN EXISTS (
           SELECT 1 FROM pg_catalog.pg_policy p
           WHERE p.polrelid = c.oid AND p.polcmd IN ('a', '*')
             AND (0 = ANY(p.polroles)
                  OR 'demos_staging_runtime'::regrole::oid = ANY(p.polroles))
         ) ELSE NULL END AS selection_insert_policy_declared,
         CASE WHEN r.relation_name = 'political_selections' THEN EXISTS (
           SELECT 1 FROM pg_catalog.pg_policy p
           WHERE p.polrelid = c.oid AND p.polcmd IN ('w', '*')
             AND (0 = ANY(p.polroles)
                  OR 'demos_staging_runtime'::regrole::oid = ANY(p.polroles))
         ) ELSE NULL END AS selection_update_policy_declared,
         CASE WHEN r.relation_name = 'political_selections' THEN EXISTS (
           SELECT 1 FROM pg_catalog.pg_policy p
           WHERE p.polrelid = c.oid AND p.polcmd IN ('d', '*')
             AND (0 = ANY(p.polroles)
                  OR 'demos_staging_runtime'::regrole::oid = ANY(p.polroles))
         ) ELSE NULL END AS selection_delete_policy_declared
  FROM required r
  LEFT JOIN pg_catalog.pg_namespace n ON n.nspname = 'public'
  LEFT JOIN pg_catalog.pg_class c
    ON c.relnamespace = n.oid
   AND c.relname = r.relation_name
   AND c.relkind IN ('r', 'p')
)
SELECT relation_name, mandatory_for_e2e, purpose,
       relation_oid IS NOT NULL AS exists_in_public,
       missing_columns,
       canonical_selection_unique_key_ready,
       legacy_selection_unique_key_conflict,
       selection_has_incoming_foreign_keys,
       runtime_can_select, rls_enabled, runtime_read_policy_declared,
       runtime_can_insert, runtime_can_update, runtime_can_delete,
       selection_insert_policy_declared, selection_update_policy_declared,
       selection_delete_policy_declared,
       CASE
         WHEN relation_oid IS NULL
           THEN CASE WHEN mandatory_for_e2e
                     THEN 'BLOCKED_MISSING_RELATION'
                     ELSE 'OPTIONAL_SCHEMA_ABSENT' END
         WHEN cardinality(missing_columns) > 0 THEN 'BLOCKED_MISSING_COLUMNS'
         WHEN relation_name = 'political_selections'
          AND legacy_selection_unique_key_conflict
          AND selection_has_incoming_foreign_keys
          THEN 'BLOCKED_LEGACY_SELECTION_KEY_REFERENCED'
         WHEN relation_name = 'political_selections'
          AND legacy_selection_unique_key_conflict
          THEN 'BLOCKED_LEGACY_SELECTION_UNIQUE_KEY_CONFLICT'
         WHEN relation_name = 'political_selections'
          AND NOT canonical_selection_unique_key_ready
          THEN 'BLOCKED_CANONICAL_CONFLICT_KEY_MISSING'
         WHEN NOT runtime_can_select THEN 'BLOCKED_NO_SELECT_GRANT'
         WHEN NOT rls_enabled THEN 'BLOCKED_RLS_DISABLED'
         WHEN NOT runtime_read_policy_declared THEN 'BLOCKED_NO_RUNTIME_READ_POLICY'
         WHEN relation_name = 'political_selections'
           AND (NOT runtime_can_insert OR NOT runtime_can_update OR NOT runtime_can_delete)
           THEN 'BLOCKED_SELECTION_WRITE_GRANTS'
         WHEN relation_name = 'political_selections'
           AND (NOT selection_insert_policy_declared OR NOT selection_update_policy_declared
                OR NOT selection_delete_policy_declared)
           THEN 'BLOCKED_SELECTION_WRITE_POLICIES'
         ELSE 'METADATA_PASS_NOT_E2E_GO'
       END AS gate_status
FROM inventory
ORDER BY mandatory_for_e2e DESC, relation_name;
