"""Staging fixture checks; DDL is confined to ephemeral civic_ci on local PostgreSQL.
No DEMOS project, provider credentials, Firebase client or real users are used.
"""
import os
from pathlib import Path
import unittest

from api.tests.civic_test_database_safety import require_ephemeral_civic_database_url

try:
    import psycopg2
except ImportError:
    psycopg2 = None

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "api/database/20261101_civic_staging_source_fixture.sql"
MIGRATION = ROOT / "api/database/20261101_civic_new_initiative_notifications.sql"
PREFLIGHT = ROOT / "api/scripts/civicStagingReadOnlyPreflight.sql"

SOURCES = ("eci", "iniziative_ministero", "notifiche_preferenze", "user_devices")
NEW_TABLES = (
    "civic_new_initiative_notifications",
    "civic_push_delivery_guard",
    "civic_runtime_identity",
)


@unittest.skipUnless(
    psycopg2 is not None and os.environ.get("CIVIC_TEST_DATABASE_URL"),
    "Local ephemeral PostgreSQL service is required; real DB must never be used",
)
class IsolatedStagingSchemaFixtureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        url = require_ephemeral_civic_database_url(
            os.environ["CIVIC_TEST_DATABASE_URL"]
        )
        if os.environ.get("DATABASE_URL") == url:
            raise RuntimeError("REFUSE_SHARED_DATABASE_URL")
        cls.conn = psycopg2.connect(url)
        cls.conn.autocommit = True

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def setUp(self):
        # Destructive cleanup is restricted to the isolated civic_ci CI service.
        with self.conn.cursor() as cur:
            for name in (*NEW_TABLES, *SOURCES):
                cur.execute(f"DROP TABLE IF EXISTS public.{name} CASCADE")

    def tearDown(self):
        with self.conn.cursor() as cur:
            for name in (*NEW_TABLES, *SOURCES):
                cur.execute(f"DROP TABLE IF EXISTS public.{name} CASCADE")

    def test_requires_separate_approval_before_any_schema_change(self):
        sql = FIXTURE.read_text(encoding="utf8")
        with self.conn.cursor() as cur:
            with self.assertRaisesRegex(Exception, "EXPLICIT_APPROVAL_REQUIRED"):
                cur.execute(sql)
            cur.execute("SELECT to_regclass('public.eci')")
            self.assertEqual(cur.fetchone(), (None,))

            cur.execute("BEGIN")
            cur.execute("SET LOCAL civic.fixture_environment = 'staging'")
            with self.assertRaisesRegex(Exception, "EXPLICIT_APPROVAL_REQUIRED"):
                cur.execute(sql)
            cur.execute("ROLLBACK")
            cur.execute("SELECT to_regclass('public.user_devices')")
            self.assertEqual(cur.fetchone(), (None,))

    def test_source_fixture_and_real_migration_pass_seven_table_preflight(self):
        sql = FIXTURE.read_text(encoding="utf8")
        with self.conn.cursor() as cur:
            cur.execute("BEGIN")
            cur.execute("SET LOCAL civic.fixture_environment = 'staging'")
            cur.execute(
                "SET LOCAL civic.fixture_approval = "
                "'I_APPROVE_SYNTHETIC_CIVIC_STAGING_SCHEMA'"
            )
            cur.execute(sql)
            cur.execute("COMMIT")

            cur.execute("SELECT count(*) FROM public.user_devices")
            self.assertEqual(cur.fetchone(), (0,))
            cur.execute("SELECT count(*) FROM public.notifiche_preferenze")
            self.assertEqual(cur.fetchone(), (0,))
            cur.execute("SELECT count(*) FROM public.eci")
            self.assertEqual(cur.fetchone(), (0,))
            cur.execute("SELECT count(*) FROM public.iniziative_ministero")
            self.assertEqual(cur.fetchone(), (0,))

            # A second invocation refuses to touch existing source tables.
            cur.execute("BEGIN")
            cur.execute("SET LOCAL civic.fixture_environment = 'staging'")
            cur.execute(
                "SET LOCAL civic.fixture_approval = "
                "'I_APPROVE_SYNTHETIC_CIVIC_STAGING_SCHEMA'"
            )
            with self.assertRaisesRegex(Exception, "SOURCE_TABLE_ALREADY_EXISTS"):
                cur.execute(sql)
            cur.execute("ROLLBACK")

            # Synthetic records only; baseline migration must suppress history.
            cur.execute(
                """INSERT INTO public.iniziative_ministero
                     (id, id_ministero, titolo, tipo, stato, data_fine)
                   VALUES
                     ('synthetic-1', 'synthetic-min-1', 'Referendum di prova',
                      'Referendum  abrogativo', 'in_corso', CURRENT_DATE + 10),
                     ('synthetic-2', 'synthetic-min-2', 'Iniziativa di prova',
                      'Iniziativa popolare', 'in_corso', CURRENT_DATE + 10)"""
            )
            cur.execute(
                """INSERT INTO public.eci (id, title, status)
                   VALUES ('synthetic-eci-1', 'ECI di prova', 'ONGOING')"""
            )
            cur.execute(MIGRATION.read_text(encoding="utf8"))

            cur.execute(PREFLIGHT.read_text(encoding="utf8"))
            rows = cur.fetchall()
            self.assertEqual(len(rows), 7)
            self.assertEqual({row[5] for row in rows}, {"STRUCTURE_OK"})
            self.assertTrue(all(row[1] and row[4] for row in rows))

            cur.execute(
                """SELECT category, status
                   FROM public.civic_new_initiative_notifications"""
            )
            baseline = cur.fetchall()
            self.assertEqual(len(baseline), 3)
            self.assertEqual({r[1] for r in baseline}, {"suppressed"})

            cur.execute(
                """SELECT blocked FROM public.civic_push_delivery_guard
                   WHERE id = 1"""
            )
            self.assertEqual(cur.fetchone(), (True,))
            cur.execute(
                """INSERT INTO public.notifiche_preferenze (user_id)
                   VALUES (gen_random_uuid())
                   RETURNING iniziative_popolari, referendum_abrogativi, eci"""
            )
            self.assertEqual(cur.fetchone(), (False, False, False))


if __name__ == "__main__":
    unittest.main()
