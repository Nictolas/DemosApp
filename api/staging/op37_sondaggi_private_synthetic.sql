-- OP-37, 2026-10-24. Synthetic-only private benchmark schema. Do not apply to DEMOS production.

-- Target exclusively Supabase project Demos-Staging (fkeayjzvtuvzesljhjbc).

-- This schema is NOT exposed to the Data API. All objects have RLS and no anon/authenticated grants.

CREATE SCHEMA op37_sondaggi_ci;

COMMENT ON SCHEMA op37_sondaggi_ci IS 'OP-37 synthetic staging benchmark only: deterministic accounts, not real personal data';

REVOKE ALL ON SCHEMA op37_sondaggi_ci FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE op37_sondaggi_ci.opinioni_domande (id text PRIMARY KEY, text text NOT NULL, gradi_opinione text[] NOT NULL);

CREATE TABLE op37_sondaggi_ci.users (id uuid PRIMARY KEY, account_type text NOT NULL, political_opinions_consent boolean, regione_residenza text, provincia_residenza text, comune_residenza text);

CREATE TABLE op37_sondaggi_ci.user_consents (user_id uuid PRIMARY KEY REFERENCES op37_sondaggi_ci.users(id), political_opinions_consent boolean);

CREATE TABLE op37_sondaggi_ci.opinioni_risposte (user_id uuid PRIMARY KEY REFERENCES op37_sondaggi_ci.users(id), "synthetic_opinion_000" text,
  "synthetic_opinion_001" text,
  "synthetic_opinion_002" text,
  "synthetic_opinion_003" text,
  "synthetic_opinion_004" text,
  "synthetic_opinion_005" text,
  "synthetic_opinion_006" text,
  "synthetic_opinion_007" text,
  "synthetic_opinion_008" text,
  "synthetic_opinion_009" text,
  "synthetic_opinion_010" text,
  "synthetic_opinion_011" text,
  "synthetic_opinion_012" text,
  "synthetic_opinion_013" text,
  "synthetic_opinion_014" text,
  "synthetic_opinion_015" text,
  "synthetic_opinion_016" text,
  "synthetic_opinion_017" text,
  "synthetic_opinion_018" text,
  "synthetic_opinion_019" text,
  "synthetic_opinion_020" text,
  "synthetic_opinion_021" text,
  "synthetic_opinion_022" text,
  "synthetic_opinion_023" text,
  "synthetic_opinion_024" text,
  "synthetic_opinion_025" text,
  "synthetic_opinion_026" text,
  "synthetic_opinion_027" text,
  "synthetic_opinion_028" text,
  "synthetic_opinion_029" text,
  "synthetic_opinion_030" text,
  "synthetic_opinion_031" text,
  "synthetic_opinion_032" text,
  "synthetic_opinion_033" text,
  "synthetic_opinion_034" text,
  "synthetic_opinion_035" text,
  "synthetic_opinion_036" text,
  "synthetic_opinion_037" text,
  "synthetic_opinion_038" text,
  "synthetic_opinion_039" text,
  "synthetic_opinion_040" text,
  "synthetic_opinion_041" text,
  "synthetic_opinion_042" text,
  "synthetic_opinion_043" text,
  "synthetic_opinion_044" text,
  "synthetic_opinion_045" text,
  "synthetic_opinion_046" text,
  "synthetic_opinion_047" text,
  "synthetic_opinion_048" text,
  "synthetic_opinion_049" text,
  "synthetic_opinion_050" text,
  "synthetic_opinion_051" text,
  "synthetic_opinion_052" text,
  "synthetic_opinion_053" text,
  "synthetic_opinion_054" text,
  "synthetic_opinion_055" text,
  "synthetic_opinion_056" text,
  "synthetic_opinion_057" text,
  "synthetic_opinion_058" text,
  "synthetic_opinion_059" text,
  "synthetic_opinion_060" text,
  "synthetic_opinion_061" text,
  "synthetic_opinion_062" text,
  "synthetic_opinion_063" text,
  "synthetic_opinion_064" text,
  "synthetic_opinion_065" text,
  "synthetic_opinion_066" text,
  "synthetic_opinion_067" text,
  "synthetic_opinion_068" text,
  "synthetic_opinion_069" text,
  "synthetic_opinion_070" text,
  "synthetic_opinion_071" text,
  "synthetic_opinion_072" text,
  "synthetic_opinion_073" text,
  "synthetic_opinion_074" text,
  "synthetic_opinion_075" text,
  "synthetic_opinion_076" text,
  "synthetic_opinion_077" text,
  "synthetic_opinion_078" text,
  "synthetic_opinion_079" text,
  "synthetic_opinion_080" text,
  "synthetic_opinion_081" text,
  "synthetic_opinion_082" text,
  "synthetic_opinion_083" text,
  "synthetic_opinion_084" text,
  "synthetic_opinion_085" text,
  "synthetic_opinion_086" text,
  "synthetic_opinion_087" text,
  "synthetic_opinion_088" text,
  "synthetic_opinion_089" text,
  "synthetic_opinion_090" text,
  "synthetic_opinion_091" text,
  "synthetic_opinion_092" text,
  "synthetic_opinion_093" text);

ALTER TABLE op37_sondaggi_ci.opinioni_domande ENABLE ROW LEVEL SECURITY;

ALTER TABLE op37_sondaggi_ci.users ENABLE ROW LEVEL SECURITY;

ALTER TABLE op37_sondaggi_ci.user_consents ENABLE ROW LEVEL SECURITY;

ALTER TABLE op37_sondaggi_ci.opinioni_risposte ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA op37_sondaggi_ci FROM PUBLIC, anon, authenticated, service_role;

INSERT INTO op37_sondaggi_ci.opinioni_domande (id,text,gradi_opinione) SELECT 'synthetic_opinion_'||lpad(g::text,3,'0'), 'Synthetic opinion '||g, CASE WHEN g=92 THEN ARRAY['da approvare']::text[] ELSE ARRAY['N']::text[] END FROM generate_series(0,93) g;

INSERT INTO op37_sondaggi_ci.users (id,account_type,political_opinions_consent,regione_residenza,provincia_residenza,comune_residenza) SELECT ('00000000-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid,CASE WHEN g%17=0 THEN 'ORGANIZATION' ELSE 'PERSON' END, g%13<>0, CASE WHEN g<=10 OR g%3=0 THEN 'TO' ELSE 'LO' END, CASE WHEN g<=10 OR g%3=0 THEN 'PI' ELSE 'MI' END, CASE WHEN g<=10 OR g%3=0 THEN 'Pisa' ELSE 'Milano' END FROM generate_series(1,1200) g;

INSERT INTO op37_sondaggi_ci.user_consents (user_id,political_opinions_consent) SELECT id,false FROM op37_sondaggi_ci.users WHERE right(id::text,12)::bigint>20 AND right(id::text,12)::bigint%29=0;

INSERT INTO op37_sondaggi_ci.opinioni_risposte (user_id, "synthetic_opinion_000","synthetic_opinion_001","synthetic_opinion_002","synthetic_opinion_003","synthetic_opinion_004","synthetic_opinion_005","synthetic_opinion_006","synthetic_opinion_007","synthetic_opinion_008","synthetic_opinion_009","synthetic_opinion_010","synthetic_opinion_011","synthetic_opinion_012","synthetic_opinion_013","synthetic_opinion_014","synthetic_opinion_015","synthetic_opinion_016","synthetic_opinion_017","synthetic_opinion_018","synthetic_opinion_019","synthetic_opinion_020","synthetic_opinion_021","synthetic_opinion_022","synthetic_opinion_023","synthetic_opinion_024","synthetic_opinion_025","synthetic_opinion_026","synthetic_opinion_027","synthetic_opinion_028","synthetic_opinion_029","synthetic_opinion_030","synthetic_opinion_031","synthetic_opinion_032","synthetic_opinion_033","synthetic_opinion_034","synthetic_opinion_035","synthetic_opinion_036","synthetic_opinion_037","synthetic_opinion_038","synthetic_opinion_039","synthetic_opinion_040","synthetic_opinion_041","synthetic_opinion_042","synthetic_opinion_043","synthetic_opinion_044","synthetic_opinion_045","synthetic_opinion_046","synthetic_opinion_047","synthetic_opinion_048","synthetic_opinion_049","synthetic_opinion_050","synthetic_opinion_051","synthetic_opinion_052","synthetic_opinion_053","synthetic_opinion_054","synthetic_opinion_055","synthetic_opinion_056","synthetic_opinion_057","synthetic_opinion_058","synthetic_opinion_059","synthetic_opinion_060","synthetic_opinion_061","synthetic_opinion_062","synthetic_opinion_063","synthetic_opinion_064","synthetic_opinion_065","synthetic_opinion_066","synthetic_opinion_067","synthetic_opinion_068","synthetic_opinion_069","synthetic_opinion_070","synthetic_opinion_071","synthetic_opinion_072","synthetic_opinion_073","synthetic_opinion_074","synthetic_opinion_075","synthetic_opinion_076","synthetic_opinion_077","synthetic_opinion_078","synthetic_opinion_079","synthetic_opinion_080","synthetic_opinion_081","synthetic_opinion_082","synthetic_opinion_083","synthetic_opinion_084","synthetic_opinion_085","synthetic_opinion_086","synthetic_opinion_087","synthetic_opinion_088","synthetic_opinion_089","synthetic_opinion_090","synthetic_opinion_091","synthetic_opinion_092","synthetic_opinion_093") SELECT ('00000000-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid,CASE WHEN (g+0*7)%11=0 THEN CASE WHEN (g+0)%3=0 THEN 'f' WHEN (g+0)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+1*7)%11=0 THEN CASE WHEN (g+1)%3=0 THEN 'f' WHEN (g+1)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+2*7)%11=0 THEN CASE WHEN (g+2)%3=0 THEN 'f' WHEN (g+2)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+3*7)%11=0 THEN CASE WHEN (g+3)%3=0 THEN 'f' WHEN (g+3)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+4*7)%11=0 THEN CASE WHEN (g+4)%3=0 THEN 'f' WHEN (g+4)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+5*7)%11=0 THEN CASE WHEN (g+5)%3=0 THEN 'f' WHEN (g+5)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+6*7)%11=0 THEN CASE WHEN (g+6)%3=0 THEN 'f' WHEN (g+6)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+7*7)%11=0 THEN CASE WHEN (g+7)%3=0 THEN 'f' WHEN (g+7)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+8*7)%11=0 THEN CASE WHEN (g+8)%3=0 THEN 'f' WHEN (g+8)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+9*7)%11=0 THEN CASE WHEN (g+9)%3=0 THEN 'f' WHEN (g+9)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+10*7)%11=0 THEN CASE WHEN (g+10)%3=0 THEN 'f' WHEN (g+10)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+11*7)%11=0 THEN CASE WHEN (g+11)%3=0 THEN 'f' WHEN (g+11)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+12*7)%11=0 THEN CASE WHEN (g+12)%3=0 THEN 'f' WHEN (g+12)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+13*7)%11=0 THEN CASE WHEN (g+13)%3=0 THEN 'f' WHEN (g+13)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+14*7)%11=0 THEN CASE WHEN (g+14)%3=0 THEN 'f' WHEN (g+14)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+15*7)%11=0 THEN CASE WHEN (g+15)%3=0 THEN 'f' WHEN (g+15)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+16*7)%11=0 THEN CASE WHEN (g+16)%3=0 THEN 'f' WHEN (g+16)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+17*7)%11=0 THEN CASE WHEN (g+17)%3=0 THEN 'f' WHEN (g+17)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+18*7)%11=0 THEN CASE WHEN (g+18)%3=0 THEN 'f' WHEN (g+18)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+19*7)%11=0 THEN CASE WHEN (g+19)%3=0 THEN 'f' WHEN (g+19)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+20*7)%11=0 THEN CASE WHEN (g+20)%3=0 THEN 'f' WHEN (g+20)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+21*7)%11=0 THEN CASE WHEN (g+21)%3=0 THEN 'f' WHEN (g+21)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+22*7)%11=0 THEN CASE WHEN (g+22)%3=0 THEN 'f' WHEN (g+22)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+23*7)%11=0 THEN CASE WHEN (g+23)%3=0 THEN 'f' WHEN (g+23)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+24*7)%11=0 THEN CASE WHEN (g+24)%3=0 THEN 'f' WHEN (g+24)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+25*7)%11=0 THEN CASE WHEN (g+25)%3=0 THEN 'f' WHEN (g+25)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+26*7)%11=0 THEN CASE WHEN (g+26)%3=0 THEN 'f' WHEN (g+26)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+27*7)%11=0 THEN CASE WHEN (g+27)%3=0 THEN 'f' WHEN (g+27)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+28*7)%11=0 THEN CASE WHEN (g+28)%3=0 THEN 'f' WHEN (g+28)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+29*7)%11=0 THEN CASE WHEN (g+29)%3=0 THEN 'f' WHEN (g+29)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+30*7)%11=0 THEN CASE WHEN (g+30)%3=0 THEN 'f' WHEN (g+30)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+31*7)%11=0 THEN CASE WHEN (g+31)%3=0 THEN 'f' WHEN (g+31)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+32*7)%11=0 THEN CASE WHEN (g+32)%3=0 THEN 'f' WHEN (g+32)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+33*7)%11=0 THEN CASE WHEN (g+33)%3=0 THEN 'f' WHEN (g+33)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+34*7)%11=0 THEN CASE WHEN (g+34)%3=0 THEN 'f' WHEN (g+34)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+35*7)%11=0 THEN CASE WHEN (g+35)%3=0 THEN 'f' WHEN (g+35)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+36*7)%11=0 THEN CASE WHEN (g+36)%3=0 THEN 'f' WHEN (g+36)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+37*7)%11=0 THEN CASE WHEN (g+37)%3=0 THEN 'f' WHEN (g+37)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+38*7)%11=0 THEN CASE WHEN (g+38)%3=0 THEN 'f' WHEN (g+38)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+39*7)%11=0 THEN CASE WHEN (g+39)%3=0 THEN 'f' WHEN (g+39)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+40*7)%11=0 THEN CASE WHEN (g+40)%3=0 THEN 'f' WHEN (g+40)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+41*7)%11=0 THEN CASE WHEN (g+41)%3=0 THEN 'f' WHEN (g+41)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+42*7)%11=0 THEN CASE WHEN (g+42)%3=0 THEN 'f' WHEN (g+42)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+43*7)%11=0 THEN CASE WHEN (g+43)%3=0 THEN 'f' WHEN (g+43)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+44*7)%11=0 THEN CASE WHEN (g+44)%3=0 THEN 'f' WHEN (g+44)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+45*7)%11=0 THEN CASE WHEN (g+45)%3=0 THEN 'f' WHEN (g+45)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+46*7)%11=0 THEN CASE WHEN (g+46)%3=0 THEN 'f' WHEN (g+46)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+47*7)%11=0 THEN CASE WHEN (g+47)%3=0 THEN 'f' WHEN (g+47)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+48*7)%11=0 THEN CASE WHEN (g+48)%3=0 THEN 'f' WHEN (g+48)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+49*7)%11=0 THEN CASE WHEN (g+49)%3=0 THEN 'f' WHEN (g+49)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+50*7)%11=0 THEN CASE WHEN (g+50)%3=0 THEN 'f' WHEN (g+50)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+51*7)%11=0 THEN CASE WHEN (g+51)%3=0 THEN 'f' WHEN (g+51)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+52*7)%11=0 THEN CASE WHEN (g+52)%3=0 THEN 'f' WHEN (g+52)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+53*7)%11=0 THEN CASE WHEN (g+53)%3=0 THEN 'f' WHEN (g+53)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+54*7)%11=0 THEN CASE WHEN (g+54)%3=0 THEN 'f' WHEN (g+54)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+55*7)%11=0 THEN CASE WHEN (g+55)%3=0 THEN 'f' WHEN (g+55)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+56*7)%11=0 THEN CASE WHEN (g+56)%3=0 THEN 'f' WHEN (g+56)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+57*7)%11=0 THEN CASE WHEN (g+57)%3=0 THEN 'f' WHEN (g+57)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+58*7)%11=0 THEN CASE WHEN (g+58)%3=0 THEN 'f' WHEN (g+58)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+59*7)%11=0 THEN CASE WHEN (g+59)%3=0 THEN 'f' WHEN (g+59)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+60*7)%11=0 THEN CASE WHEN (g+60)%3=0 THEN 'f' WHEN (g+60)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+61*7)%11=0 THEN CASE WHEN (g+61)%3=0 THEN 'f' WHEN (g+61)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+62*7)%11=0 THEN CASE WHEN (g+62)%3=0 THEN 'f' WHEN (g+62)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+63*7)%11=0 THEN CASE WHEN (g+63)%3=0 THEN 'f' WHEN (g+63)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+64*7)%11=0 THEN CASE WHEN (g+64)%3=0 THEN 'f' WHEN (g+64)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+65*7)%11=0 THEN CASE WHEN (g+65)%3=0 THEN 'f' WHEN (g+65)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+66*7)%11=0 THEN CASE WHEN (g+66)%3=0 THEN 'f' WHEN (g+66)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+67*7)%11=0 THEN CASE WHEN (g+67)%3=0 THEN 'f' WHEN (g+67)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+68*7)%11=0 THEN CASE WHEN (g+68)%3=0 THEN 'f' WHEN (g+68)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+69*7)%11=0 THEN CASE WHEN (g+69)%3=0 THEN 'f' WHEN (g+69)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+70*7)%11=0 THEN CASE WHEN (g+70)%3=0 THEN 'f' WHEN (g+70)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+71*7)%11=0 THEN CASE WHEN (g+71)%3=0 THEN 'f' WHEN (g+71)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+72*7)%11=0 THEN CASE WHEN (g+72)%3=0 THEN 'f' WHEN (g+72)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+73*7)%11=0 THEN CASE WHEN (g+73)%3=0 THEN 'f' WHEN (g+73)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+74*7)%11=0 THEN CASE WHEN (g+74)%3=0 THEN 'f' WHEN (g+74)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+75*7)%11=0 THEN CASE WHEN (g+75)%3=0 THEN 'f' WHEN (g+75)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+76*7)%11=0 THEN CASE WHEN (g+76)%3=0 THEN 'f' WHEN (g+76)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+77*7)%11=0 THEN CASE WHEN (g+77)%3=0 THEN 'f' WHEN (g+77)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+78*7)%11=0 THEN CASE WHEN (g+78)%3=0 THEN 'f' WHEN (g+78)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+79*7)%11=0 THEN CASE WHEN (g+79)%3=0 THEN 'f' WHEN (g+79)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+80*7)%11=0 THEN CASE WHEN (g+80)%3=0 THEN 'f' WHEN (g+80)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+81*7)%11=0 THEN CASE WHEN (g+81)%3=0 THEN 'f' WHEN (g+81)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+82*7)%11=0 THEN CASE WHEN (g+82)%3=0 THEN 'f' WHEN (g+82)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+83*7)%11=0 THEN CASE WHEN (g+83)%3=0 THEN 'f' WHEN (g+83)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+84*7)%11=0 THEN CASE WHEN (g+84)%3=0 THEN 'f' WHEN (g+84)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+85*7)%11=0 THEN CASE WHEN (g+85)%3=0 THEN 'f' WHEN (g+85)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+86*7)%11=0 THEN CASE WHEN (g+86)%3=0 THEN 'f' WHEN (g+86)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+87*7)%11=0 THEN CASE WHEN (g+87)%3=0 THEN 'f' WHEN (g+87)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+88*7)%11=0 THEN CASE WHEN (g+88)%3=0 THEN 'f' WHEN (g+88)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+89*7)%11=0 THEN CASE WHEN (g+89)%3=0 THEN 'f' WHEN (g+89)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+90*7)%11=0 THEN CASE WHEN (g+90)%3=0 THEN 'f' WHEN (g+90)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+91*7)%11=0 THEN CASE WHEN (g+91)%3=0 THEN 'f' WHEN (g+91)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN (g+92*7)%11=0 THEN CASE WHEN (g+92)%3=0 THEN 'f' WHEN (g+92)%3=1 THEN 'c' ELSE 'i' END ELSE NULL END,
  CASE WHEN g BETWEEN 1 AND 10 THEN 'f' ELSE NULL END FROM generate_series(1,1200) g;

ANALYZE op37_sondaggi_ci.users;

ANALYZE op37_sondaggi_ci.user_consents;

ANALYZE op37_sondaggi_ci.opinioni_risposte;

COMMENT ON TABLE op37_sondaggi_ci.opinioni_risposte IS '1200 deterministic synthetic vote rows. Never expose to the public Data API';

-- No Render service or credentials are altered by this migration.
