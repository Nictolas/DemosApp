"""Exercise the P0 staging migration on an isolated, disposable civic_ci PostgreSQL.
Never connects to Demos-Staging, production, Render or any remote provider.
"""
import hashlib
import os
import unittest
from pathlib import Path

from api.tests.civic_test_database_safety import require_ephemeral_civic_database_url

try:
    import psycopg2
except ImportError:
    psycopg2 = None

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = (ROOT / "api/database/staging/ops_stg_001_p0_app_routes_20261103.sql").read_text(encoding="utf-8")
STAGING_HASH = "0cbb6ace68a9f11956904e2a37898ec8"
SYNTHETIC_ID = "00000000-0000-4000-8000-00000000cafe"
WRONG_ID = "11111111-1111-4111-8111-111111111111"
TABLES = ("user_profile", "notifiche_demos", "iniziative_popolari", "referendum_abrogativi")


@unittest.skipUnless(psycopg2 is not None and os.getenv("CIVIC_TEST_DATABASE_URL"),
                     "Dedicated ephemeral civic_ci PostgreSQL required")
class P0StagingMigrationPostgresTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        url = require_ephemeral_civic_database_url(os.environ["CIVIC_TEST_DATABASE_URL"])
        if os.environ.get("DATABASE_URL") == url:
            raise RuntimeError("REFUSE_SHARED_DATABASE_URL")
        cls.conn = psycopg2.connect(url)
        cls.conn.autocommit = True
        with cls.conn.cursor() as cur:
            for role in ("anon", "authenticated"):
                cur.execute("SELECT 1 FROM pg_roles WHERE rolname=%s", (role,))
                if cur.fetchone() is None:
                    cur.execute("CREATE ROLE " + role + " NOLOGIN")
            cur.execute("CREATE TABLE public.users (id uuid PRIMARY KEY)")
            cur.execute("CREATE TABLE public.civic_runtime_identity (id smallint PRIMARY KEY, db_identity uuid NOT NULL)")
            cur.execute("INSERT INTO public.civic_runtime_identity VALUES (1, %s)", (WRONG_ID,))

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()  # GitHub runner destroys the entire PostgreSQL fixture.

    def test_identity_gate_atomic_creation_privileges_and_repeat_refusal(self):
        # Transform only the expected identity hash in an in-memory COPY of the
        # migration, because no real staging identity should be used in CI.
        self.assertEqual(MIGRATION.count(STAGING_HASH), 1)
        fake_hash = hashlib.md5(SYNTHETIC_ID.encode("ascii")).hexdigest()
        sql = MIGRATION.replace(STAGING_HASH, fake_hash)

        with self.conn.cursor() as cur:
            with self.assertRaisesRegex(psycopg2.Error, "STOP: DB is not authorized Demos-Staging"):
                cur.execute(sql)
            cur.execute("ROLLBACK")
            for name in TABLES:
                cur.execute("SELECT to_regclass(%s)", ("public." + name,))
                self.assertIsNone(cur.fetchone()[0], "Guard must reject before DDL")

            cur.execute("UPDATE public.civic_runtime_identity SET db_identity=%s WHERE id=1",
                        (SYNTHETIC_ID,))
            cur.execute(sql)  # Exact DDL executes against PostgreSQL 16 CI.
            for name in TABLES:
                cur.execute("SELECT to_regclass(%s)", ("public." + name,))
                self.assertIsNotNone(cur.fetchone()[0])
                cur.execute("SELECT relrowsecurity FROM pg_class WHERE oid=%s::regclass",
                            ("public." + name,))
                self.assertEqual(cur.fetchone(), (True,))
                for role in ("anon", "authenticated"):
                    cur.execute("SELECT has_table_privilege(%s, %s, 'SELECT,INSERT,UPDATE,DELETE')",
                                (role, "public." + name))
                    self.assertEqual(cur.fetchone(), (False,))
                cur.execute("SELECT COUNT(*) FROM public." + name)
                self.assertEqual(cur.fetchone(), (0,))

            cur.execute("""SELECT COUNT(*) FROM information_schema.columns
                           WHERE table_schema='public' AND table_name = ANY(%s)""", (list(TABLES),))
            self.assertEqual(cur.fetchone()[0], 73)
            cur.execute("""SELECT COUNT(*) FROM pg_constraint
                           WHERE conrelid = ANY(%s::regclass[])""",
                        (["public." + x for x in TABLES],))
            self.assertEqual(cur.fetchone()[0], 7)
            cur.execute("""SELECT COUNT(*) FROM pg_indexes
                           WHERE schemaname='public' AND tablename=ANY(%s)""", (list(TABLES),))
            self.assertEqual(cur.fetchone()[0], 9)

            # Even on the right isolated DB, a second application must abort.
            with self.assertRaisesRegex(psycopg2.Error, "STOP: target P0 table already exists"):
                cur.execute(sql)
            cur.execute("ROLLBACK")
            for name in TABLES:
                cur.execute("SELECT COUNT(*) FROM public." + name)
                self.assertEqual(cur.fetchone(), (0,))


if __name__ == "__main__":
    unittest.main()
