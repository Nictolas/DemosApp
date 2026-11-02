"""Synthetic-only staging rehearsal when user_devices already exists.

Destructive setup is guarded to the dedicated local civic_ci PostgreSQL
fixture. Never connect this test to a real Supabase project.
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
FIXTURE = ROOT / "api/database/20261102_civic_staging_existing_devices_fixture.sql"
MIGRATION = ROOT / "api/database/20261101_civic_new_initiative_notifications.sql"
PREFLIGHT = ROOT / "api/scripts/civicStagingReadOnlyPreflight.sql"
USERS_PREFLIGHT = ROOT / "api/scripts/civicStagingUsersReadOnlyPreflight.sql"

CLEAN_TABLES = (
    "civic_new_initiative_notifications", "civic_push_delivery_guard",
    "civic_runtime_identity", "eci", "iniziative_ministero",
    "notifiche_preferenze", "user_devices", "users"
)


@unittest.skipUnless(
    psycopg2 is not None and os.environ.get("CIVIC_TEST_DATABASE_URL"),
    "Only the local ephemeral PostgreSQL civic_ci service is permitted",
)
class ExistingDevicesCivicFixtureTest(unittest.TestCase):
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
        self.cleanup()
        with self.conn.cursor() as cur:
            cur.execute("CREATE TABLE public.users (id UUID PRIMARY KEY)")
            cur.execute("ALTER TABLE public.users ENABLE ROW LEVEL SECURITY")
            cur.execute("""
                CREATE TABLE public.user_devices (
                    id BIGSERIAL PRIMARY KEY,
                    user_id UUID NOT NULL REFERENCES public.users(id)
                        ON DELETE CASCADE,
                    fcm_token TEXT NOT NULL UNIQUE,
                    platform TEXT,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    last_seen_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute("ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY")
            cur.execute("""
                INSERT INTO public.users (id) VALUES
                ('11111111-1111-4111-8111-111111111111'),
                ('22222222-2222-4222-8222-222222222222')
            """)

    def tearDown(self):
        self.cleanup()

    def cleanup(self):
        with self.conn.cursor() as cur:
            for name in CLEAN_TABLES:
                cur.execute(f"DROP TABLE IF EXISTS public.{name} CASCADE")

    @staticmethod
    def approve(cur):
        cur.execute("BEGIN")
        cur.execute("SET LOCAL civic.fixture_environment = 'staging'")
        cur.execute(
            "SET LOCAL civic.fixture_approval = "
            "'I_APPROVE_SYNTHETIC_CIVIC_STAGING_SCHEMA'"
        )

    def test_requires_explicit_approval_without_any_change(self):
        with self.conn.cursor() as cur:
            with self.assertRaisesRegex(Exception, "EXPLICIT_APPROVAL_REQUIRED"):
                cur.execute(FIXTURE.read_text(encoding="utf8"))
            cur.execute("SELECT to_regclass('public.eci')")
            self.assertEqual(cur.fetchone(), (None,))
            cur.execute("""
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'users'
                  AND column_name = 'status'
            """)
            self.assertIsNone(cur.fetchone())

    def test_preserves_existing_devices_and_passes_seven_table_preflight(self):
        with self.conn.cursor() as cur:
            cur.execute("SELECT 'public.user_devices'::regclass::oid")
            device_oid = cur.fetchone()[0]
            cur.execute("""
                SELECT count(*) FROM pg_constraint
                WHERE conrelid = 'public.user_devices'::regclass
                  AND contype = 'f'
            """)
            self.assertEqual(cur.fetchone(), (1,))

            self.approve(cur)
            cur.execute(FIXTURE.read_text(encoding="utf8"))
            cur.execute("COMMIT")

            cur.execute("SELECT 'public.user_devices'::regclass::oid")
            self.assertEqual(cur.fetchone()[0], device_oid)
            cur.execute("SELECT COUNT(*) FROM public.user_devices")
            self.assertEqual(cur.fetchone(), (0,))
            cur.execute("SELECT COUNT(*) FROM public.users WHERE status = 'pending'")
            self.assertEqual(cur.fetchone(), (2,))

            cur.execute(MIGRATION.read_text(encoding="utf8"))
            cur.execute(PREFLIGHT.read_text(encoding="utf8"))
            schema_rows = cur.fetchall()
            self.assertEqual(len(schema_rows), 7)
            self.assertEqual({row[5] for row in schema_rows}, {"STRUCTURE_OK"})
            cur.execute(USERS_PREFLIGHT.read_text(encoding="utf8"))
            self.assertEqual(cur.fetchone()[4], "STRUCTURE_OK")
            cur.execute("SELECT blocked FROM public.civic_push_delivery_guard WHERE id = 1")
            self.assertEqual(cur.fetchone(), (True,))
            cur.execute("""
                SELECT iniziative_popolari, referendum_abrogativi, eci
                FROM public.notifiche_preferenze
                WHERE user_id = '11111111-1111-4111-8111-111111111111'
            """)
            self.assertIsNone(cur.fetchone())
            cur.execute("""
                SELECT count(*) FROM public.civic_new_initiative_notifications
            """)
            self.assertEqual(cur.fetchone(), (0,))

    def test_rejects_existing_device_without_changes(self):
        with self.conn.cursor() as cur:
            cur.execute("""
                INSERT INTO public.user_devices (user_id, fcm_token)
                VALUES ('11111111-1111-4111-8111-111111111111',
                        'synthetic_not_real_fcm')
            """)
            self.approve(cur)
            with self.assertRaisesRegex(Exception, "EXISTING_DEVICES_NOT_EMPTY"):
                cur.execute(FIXTURE.read_text(encoding="utf8"))
            cur.execute("ROLLBACK")
            cur.execute("SELECT COUNT(*) FROM public.user_devices")
            self.assertEqual(cur.fetchone(), (1,))
            cur.execute("SELECT to_regclass('public.eci')")
            self.assertEqual(cur.fetchone(), (None,))

    def test_rejects_disabled_rls_without_changes(self):
        with self.conn.cursor() as cur:
            cur.execute("ALTER TABLE public.user_devices DISABLE ROW LEVEL SECURITY")
            self.approve(cur)
            with self.assertRaisesRegex(Exception, "RLS_REQUIRED"):
                cur.execute(FIXTURE.read_text(encoding="utf8"))
            cur.execute("ROLLBACK")
            cur.execute("SELECT to_regclass('public.notifiche_preferenze')")
            self.assertEqual(cur.fetchone(), (None,))


if __name__ == "__main__":
    unittest.main()
