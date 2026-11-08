"""Seed a STRICTLY loopback-only PostgreSQL 16/17 fixture for the actual JS
referendum snapshot service. No Supabase/Render credentials or network access.
"""
import hashlib
import os
from pathlib import Path

import psycopg2
from api.tests.civic_test_database_safety import require_ephemeral_civic_database_url

ROOT = Path(__file__).resolve().parents[2]
STAGING_HASH = "0cbb6ace68a9f11956904e2a37898ec8"
SYNTHETIC_ID = "00000000-0000-4000-8000-00000000cafe"
DSN = "postgresql://postgres:civic_ci_only@127.0.0.1:5432/civic_ci"
MIGRATIONS = [
    "ops_stg_001_p1_routes_20261103.sql",
    "ops_stg_001_p2_opinion_referendum_parliament_20261103.sql",
    "ops_stg_001_p3_ballots_notifications_segnalazioni_20261103.sql",
    "ops_stg_001_p4_preference_cooldowns_20261103.sql",
    "ops_stg_001_p5_forecast_snapshots_20261103.sql",
]

def main():
    target = require_ephemeral_civic_database_url(os.environ.get("CIVIC_TEST_DATABASE_URL", ""))
    if target != DSN or os.environ.get("DATABASE_URL"):
        raise RuntimeError("REFUSE_NON_CI_POSTGRES")
    fake_hash = hashlib.md5(SYNTHETIC_ID.encode("ascii")).hexdigest()
    with psycopg2.connect(target) as conn:
        expected_major = int(os.environ.get("CIVIC_CI_POSTGRES_MAJOR", "0"))
        if conn.server_version // 10000 != expected_major or expected_major not in (16, 17):
            raise RuntimeError("CIVIC_CI_POSTGRES_ENGINE_MISMATCH")
        conn.autocommit = True
        with conn.cursor() as cur:
            for role in ("anon", "authenticated", "demos_staging_runtime"):
                cur.execute("SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=%s", (role,))
                if not cur.fetchone():
                    cur.execute("CREATE ROLE " + role + " NOLOGIN NOINHERIT")
            cur.execute("""CREATE TABLE public.users
                (id uuid PRIMARY KEY, status varchar(16) NOT NULL DEFAULT 'pending')""")
            cur.execute("CREATE TABLE public.eventi (id uuid PRIMARY KEY)")
            cur.execute("CREATE TABLE public.civic_processes (id uuid PRIMARY KEY)")
            cur.execute("""INSERT INTO public.users(id) VALUES
                ('00000000-0000-4000-8000-000000000301'),
                ('00000000-0000-4000-8000-000000000302')""")
            cur.execute("""INSERT INTO public.civic_processes(id)
                VALUES ('00000000-0000-4000-8000-00000000b001')""")
            cur.execute("""CREATE TABLE public.civic_runtime_identity
                (id smallint PRIMARY KEY, db_identity uuid NOT NULL)""")
            cur.execute("INSERT INTO public.civic_runtime_identity VALUES (1,%s)", (SYNTHETIC_ID,))
            cur.execute("""CREATE TABLE public.civic_push_delivery_guard
                (id smallint PRIMARY KEY, blocked boolean NOT NULL)""")
            cur.execute("INSERT INTO public.civic_push_delivery_guard VALUES (1,TRUE)")
            for filename in MIGRATIONS:
                original = (ROOT / "api" / "database" / "staging" / filename).read_text(encoding="utf-8")
                if original.count(STAGING_HASH) != 1 or fake_hash in original:
                    raise RuntimeError("INVALID_SYNTHETIC_MIGRATION_GUARD")
                cur.execute(original.replace(STAGING_HASH, fake_hash))
            # Prepare disabled preflight role ONLY inside disposable CI:
            # modify DB-name and identity checks in MEMORY, not in the
            # versioned production-guarded script; never generate a secret.
            cur.execute("ALTER TABLE public.civic_runtime_identity ENABLE ROW LEVEL SECURITY")
            cur.execute("ALTER TABLE public.civic_push_delivery_guard ENABLE ROW LEVEL SECURITY")
            role_path = (ROOT / "api/database/staging" /
                         "ops_stg_001_preflight_role_disabled_20261103.sql")
            role_source = role_path.read_text(encoding="utf-8")
            if (role_source.count(STAGING_HASH) != 1 or
                role_source.count("current_database() <> 'postgres'") != 1):
                raise RuntimeError("INVALID_PREFLIGHT_ROLE_MIGRATION_GUARD")
            role_ci = (role_source.replace(STAGING_HASH, fake_hash)
                       .replace("current_database() <> 'postgres'",
                                "current_database() <> 'civic_ci'"))
            cur.execute("BEGIN")
            cur.execute("""SET LOCAL civic.preflight_role_approval =
                'I_APPROVE_DISABLED_PREFLIGHT_ROLE'""")
            cur.execute(role_ci)
            cur.execute("COMMIT")
            cur.execute("""SELECT rolcanlogin,rolsuper,rolbypassrls,rolinherit
                           FROM pg_catalog.pg_roles
                           WHERE rolname='demos_staging_preflight'""")
            assert cur.fetchone() == (True,False,False,False)
            cur.execute("SELECT count(*) FROM public.civic_ballot_forecast_snapshots")
            assert cur.fetchone() == (0,)
            cur.execute("SELECT blocked FROM public.civic_push_delivery_guard WHERE id=1")
            assert cur.fetchone() == (True,)

if __name__ == "__main__":
    main()
