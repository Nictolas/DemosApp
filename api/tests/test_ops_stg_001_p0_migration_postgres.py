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
RUNTIME_ACCESS = (ROOT / "api/database/staging/ops_stg_001_p0_runtime_least_privilege_20261103.sql").read_text(encoding="utf-8")
STAGING_HASH = "0cbb6ace68a9f11956904e2a37898ec8"
SYNTHETIC_ID = "00000000-0000-4000-8000-00000000cafe"
WRONG_ID = "11111111-1111-4111-8111-111111111111"
USER_A = "00000000-0000-4000-8000-000000000301"
USER_B = "00000000-0000-4000-8000-000000000302"
USER_OUTSIDE = "33333333-3333-4333-8333-333333333333"
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
            for role in ("anon", "authenticated", "demos_staging_runtime"):
                cur.execute("SELECT 1 FROM pg_roles WHERE rolname=%s", (role,))
                if cur.fetchone() is None:
                    cur.execute("CREATE ROLE " + role + (
                        " LOGIN NOINHERIT" if role == "demos_staging_runtime" else " NOLOGIN"
                    ))
            cur.execute("CREATE TABLE public.users (id uuid PRIMARY KEY, status varchar(16) NOT NULL DEFAULT 'pending')")
            cur.execute("INSERT INTO public.users(id) VALUES (%s),(%s)", (USER_A, USER_B))
            cur.execute("CREATE TABLE public.civic_push_delivery_guard (id smallint PRIMARY KEY, blocked boolean NOT NULL)")
            cur.execute("INSERT INTO public.civic_push_delivery_guard VALUES (1, TRUE)")
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

            # The role-access migration requires its own operator approval.
            # Replace only the staging identity hash in this in-memory CI copy.
            self.assertEqual(RUNTIME_ACCESS.count(STAGING_HASH), 1)
            access = RUNTIME_ACCESS.replace(STAGING_HASH, fake_hash)
            with self.assertRaisesRegex(psycopg2.Error, "P0_RUNTIME_APPROVAL_REQUIRED"):
                cur.execute(access)
            cur.execute("ROLLBACK")
            for name in TABLES:
                cur.execute("SELECT has_table_privilege('demos_staging_runtime',%s,'SELECT')",
                            ("public." + name,))
                self.assertEqual(cur.fetchone(), (False,))

            cur.execute("UPDATE public.civic_runtime_identity SET db_identity=%s WHERE id=1", (WRONG_ID,))
            cur.execute("BEGIN")
            cur.execute("SET LOCAL civic.p0_runtime_approval='I_APPROVE_P0_SYNTHETIC_RUNTIME_ACCESS'")
            with self.assertRaisesRegex(psycopg2.Error, "P0_RUNTIME_WRONG_DATABASE"):
                cur.execute(access)
            cur.execute("ROLLBACK")
            cur.execute("UPDATE public.civic_runtime_identity SET db_identity=%s WHERE id=1", (SYNTHETIC_ID,))

            cur.execute("BEGIN")
            cur.execute("SET LOCAL civic.p0_runtime_approval='I_APPROVE_P0_SYNTHETIC_RUNTIME_ACCESS'")
            cur.execute(access)
            cur.execute("COMMIT")
            for name in TABLES:
                cur.execute("SELECT relrowsecurity FROM pg_class WHERE oid=%s::regclass",
                            ("public." + name,))
                self.assertEqual(cur.fetchone(), (True,))
                for role in ("anon", "authenticated"):
                    cur.execute("SELECT has_table_privilege(%s,%s,'SELECT,INSERT,UPDATE,DELETE')",
                                (role, "public." + name))
                    self.assertEqual(cur.fetchone(), (False,))
                cur.execute("SELECT has_table_privilege('demos_staging_runtime',%s,'SELECT')",
                            ("public." + name,))
                self.assertEqual(cur.fetchone(), (True,))
                cur.execute("SELECT has_table_privilege('demos_staging_runtime',%s,'DELETE')",
                            ("public." + name,))
                self.assertEqual(cur.fetchone(), (False,))

            for name in ("iniziative_popolari", "referendum_abrogativi"):
                cur.execute("SELECT has_table_privilege('demos_staging_runtime',%s,'INSERT,UPDATE')",
                            ("public." + name,))
                self.assertEqual(cur.fetchone(), (False,))

            # Valid third user exists, but the runtime role cannot see or
            # edit its records. Every inserted row is rolled back afterwards.
            cur.execute("BEGIN")
            cur.execute("INSERT INTO public.users(id) VALUES (%s)", (USER_OUTSIDE,))
            cur.execute("INSERT INTO public.user_profile(user_id,cittadinanza) VALUES (%s,'synthetic-hidden')",
                        (USER_OUTSIDE,))
            cur.execute("INSERT INTO public.notifiche_demos(id_utente,testo) VALUES (%s,'synthetic-hidden')",
                        (USER_OUTSIDE,))
            cur.execute("SET LOCAL ROLE demos_staging_runtime")
            cur.execute("SELECT COUNT(*) FROM public.user_profile")
            self.assertEqual(cur.fetchone()[0], 0)
            cur.execute("SELECT COUNT(*) FROM public.notifiche_demos")
            self.assertEqual(cur.fetchone()[0], 0)
            cur.execute("INSERT INTO public.user_profile(user_id,cittadinanza) VALUES (%s,'synthetic')",
                        (USER_A,))
            cur.execute("INSERT INTO public.notifiche_demos(id_utente,testo) VALUES (%s,'synthetic')",
                        (USER_A,))
            for name in ("user_profile", "notifiche_demos"):
                cur.execute("SELECT COUNT(*) FROM public." + name)
                self.assertEqual(cur.fetchone()[0], 1)
            cur.execute("SAVEPOINT rejected_user")
            with self.assertRaises(psycopg2.Error) as blocked:
                cur.execute("INSERT INTO public.user_profile(user_id) VALUES (%s)", (USER_OUTSIDE,))
            self.assertEqual(blocked.exception.pgcode, "42501")
            cur.execute("ROLLBACK TO SAVEPOINT rejected_user")
            cur.execute("SAVEPOINT rejected_notification")
            with self.assertRaises(psycopg2.Error) as blocked:
                cur.execute("INSERT INTO public.notifiche_demos(id_utente,testo) VALUES (%s,'hidden')",
                            (USER_OUTSIDE,))
            self.assertEqual(blocked.exception.pgcode, "42501")
            cur.execute("ROLLBACK TO SAVEPOINT rejected_notification")
            cur.execute("ROLLBACK")

            # Reapplying the grant migration must fail; no FCM guard change.
            cur.execute("BEGIN")
            cur.execute("SET LOCAL civic.p0_runtime_approval='I_APPROVE_P0_SYNTHETIC_RUNTIME_ACCESS'")
            with self.assertRaisesRegex(psycopg2.Error, "P0_RUNTIME_POLICIES_ALREADY_PRESENT"):
                cur.execute(access)
            cur.execute("ROLLBACK")
            cur.execute("SELECT blocked FROM public.civic_push_delivery_guard WHERE id=1")
            self.assertEqual(cur.fetchone(), (True,))
            for name in TABLES:
                cur.execute("SELECT COUNT(*) FROM public." + name)
                self.assertEqual(cur.fetchone(), (0,))


if __name__ == "__main__":
    unittest.main()
