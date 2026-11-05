"""Civic staging runtime RLS/GRANT contract on the local civic_ci PostgreSQL only.

Never run on real Demos staging or production; all DROP/CREATEs are confined
by the strict local civic_ci DSN validation.
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
SOURCE = (ROOT / 'api/database/20261102_civic_staging_existing_devices_fixture.sql').read_text(encoding='utf8')
SCHEMA = (ROOT / 'api/database/20261101_civic_new_initiative_notifications.sql').read_text(encoding='utf8')
ACCESS = (ROOT / 'api/database/20261102_civic_staging_runtime_access.sql').read_text(encoding='utf8')
PREFLIGHT = (ROOT / 'api/scripts/civicStagingRuntimeAccessReadOnlyPreflight.sql').read_text(encoding='utf8')
COLLECTOR_SMOKE = (ROOT / 'api/scripts/civicStagingCollectorRollbackSmoke.sql').read_text(encoding='utf8')
A = '00000000-0000-4000-8000-000000000301'
B = '00000000-0000-4000-8000-000000000302'
OTHER = '33333333-3333-4333-8333-333333333333'
TABLES = ('civic_new_initiative_notifications', 'civic_push_delivery_guard',
          'civic_runtime_identity', 'eci', 'iniziative_ministero',
          'notifiche_preferenze', 'user_devices', 'users')


@unittest.skipUnless(
    psycopg2 is not None and os.getenv('CIVIC_TEST_DATABASE_URL'),
    'Dedicated local civic_ci PostgreSQL is required',
)
class StagingRuntimeAccessTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        url = require_ephemeral_civic_database_url(os.environ['CIVIC_TEST_DATABASE_URL'])
        if os.getenv('DATABASE_URL') == url:
            raise RuntimeError('REFUSE_SHARED_DATABASE_URL')
        cls.conn = psycopg2.connect(url)
        cls.conn.autocommit = True

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def cleanup(self):
        with self.conn.cursor() as cur:
            for table in TABLES:
                cur.execute(f'DROP TABLE IF EXISTS public.{table} CASCADE')
            for role in ('demos_staging_runtime', 'anon', 'authenticated'):
                cur.execute('SELECT 1 FROM pg_roles WHERE rolname=%s', (role,))
                if cur.fetchone():
                    cur.execute(f'DROP ROLE {role}')

    def setUp(self):
        self.cleanup()
        with self.conn.cursor() as cur:
            cur.execute('CREATE ROLE demos_staging_runtime LOGIN NOINHERIT')
            cur.execute('CREATE ROLE anon NOLOGIN')
            cur.execute('CREATE ROLE authenticated NOLOGIN')
            cur.execute('CREATE TABLE public.users (id UUID PRIMARY KEY)')
            cur.execute('ALTER TABLE public.users ENABLE ROW LEVEL SECURITY')
            cur.execute('''
                CREATE TABLE public.user_devices (
                  id BIGSERIAL PRIMARY KEY,
                  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
                  fcm_token TEXT NOT NULL UNIQUE, platform TEXT,
                  is_active BOOLEAN NOT NULL DEFAULT TRUE,
                  last_seen_at TIMESTAMPTZ,
                  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())
            ''')
            cur.execute('ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY')
            cur.execute('INSERT INTO public.users(id) VALUES (%s),(%s)', (A, B))
            cur.execute('BEGIN')
            cur.execute("SET LOCAL civic.fixture_environment = 'staging'")
            cur.execute("SET LOCAL civic.fixture_approval = 'I_APPROVE_SYNTHETIC_CIVIC_STAGING_SCHEMA'")
            cur.execute(SOURCE)
            cur.execute('COMMIT')
            cur.execute(SCHEMA)

    def tearDown(self):
        self.cleanup()

    def apply_access(self):
        with self.conn.cursor() as cur:
            cur.execute('BEGIN')
            cur.execute("SET LOCAL civic.runtime_access_environment='staging'")
            cur.execute(
                "SET LOCAL civic.runtime_access_approval="
                "'I_APPROVE_CIVIC_STAGING_RUNTIME_ACCESS'"
            )
            cur.execute(ACCESS)
            cur.execute('COMMIT')

    def test_no_approval_no_permission_changes(self):
        with self.conn.cursor() as cur:
            with self.assertRaisesRegex(Exception, 'EXPLICIT_APPROVAL_REQUIRED'):
                cur.execute(ACCESS)
            cur.execute("""
                SELECT has_table_privilege('demos_staging_runtime',
                    'public.notifiche_preferenze','SELECT')
            """)
            self.assertEqual(cur.fetchone(), (False,))

    def test_runtime_only_and_preference_account_isolation(self):
        with self.conn.cursor() as cur:
            cur.execute(PREFLIGHT)
            self.assertNotIn('STRUCTURE_OK', {x[1] for x in cur.fetchall()})
        self.apply_access()
        with self.conn.cursor() as cur:
            cur.execute(PREFLIGHT)
            self.assertEqual(len(cur.fetchall()), 6)
            cur.execute(PREFLIGHT)
            self.assertEqual({x[1] for x in cur.fetchall()}, {'STRUCTURE_OK'})
            for table in ('eci', 'iniziative_ministero', 'notifiche_preferenze',
                          'civic_new_initiative_notifications',
                          'civic_push_delivery_guard', 'civic_runtime_identity'):
                cur.execute("SELECT has_table_privilege('anon', %s, 'SELECT'),"
                            "has_table_privilege('authenticated', %s, 'SELECT')",
                            (f'public.{table}', f'public.{table}'))
                self.assertEqual(cur.fetchone(), (False, False))

            cur.execute('BEGIN')
            cur.execute('SET LOCAL ROLE demos_staging_runtime')
            cur.execute('SELECT COUNT(*) FROM public.civic_new_initiative_notifications')
            self.assertEqual(cur.fetchone(), (0,))
            cur.execute('SELECT blocked FROM public.civic_push_delivery_guard WHERE id=1')
            self.assertEqual(cur.fetchone(), (True,))
            cur.execute('SELECT COUNT(*) FROM public.civic_runtime_identity')
            self.assertEqual(cur.fetchone(), (1,))
            cur.execute('INSERT INTO public.notifiche_preferenze(user_id) VALUES (%s)', (A,))
            cur.execute('SELECT user_id FROM public.notifiche_preferenze')
            self.assertEqual([str(x[0]) for x in cur.fetchall()], [A])
            cur.execute('SAVEPOINT disallowed_user')
            with self.assertRaises(psycopg2.Error):
                cur.execute('INSERT INTO public.notifiche_preferenze(user_id) VALUES (%s)', (OTHER,))
            cur.execute('ROLLBACK TO SAVEPOINT disallowed_user')
            cur.execute('SAVEPOINT blocked_guard')
            with self.assertRaises(psycopg2.Error):
                cur.execute('UPDATE public.civic_push_delivery_guard SET blocked=FALSE WHERE id=1')
            cur.execute('ROLLBACK TO SAVEPOINT blocked_guard')
            cur.execute('ROLLBACK')

            cur.execute('SELECT COUNT(*) FROM public.notifiche_preferenze')
            self.assertEqual(cur.fetchone(), (0,))
            cur.execute('SELECT blocked FROM public.civic_push_delivery_guard WHERE id=1')
            self.assertEqual(cur.fetchone(), (True,))

    def test_official_sources_create_only_suppressed_events_and_leave_no_rows(self):
        """Run the collector-shaped SQL in civic_ci; the SQL itself rolls back."""
        with self.conn.cursor() as cur:
            cur.execute(COLLECTOR_SMOKE)
            result = cur.fetchone()
            self.assertEqual(result, (0, 0, 0, 0, True))
            cur.execute('SELECT COUNT(*) FROM public.user_devices')
            self.assertEqual(cur.fetchone(), (0,))

    def test_smoke_refuses_non_synthetic_accounts(self):
        with self.conn.cursor() as cur:
            cur.execute('UPDATE public.users SET id=%s WHERE id=%s', (OTHER, A))
            with self.assertRaisesRegex(Exception, 'CIVIC_STAGING_COLLECTOR_SMOKE_REFUSED'):
                cur.execute(COLLECTOR_SMOKE)
            cur.execute('ROLLBACK')
            cur.execute('SELECT COUNT(*) FROM public.eci')
            self.assertEqual(cur.fetchone(), (0,))

    def test_refuses_non_synthetic_staging(self):
        with self.conn.cursor() as cur:
            cur.execute("UPDATE public.users SET id=%s WHERE id=%s", (OTHER, A))
            cur.execute('BEGIN')
            cur.execute("SET LOCAL civic.runtime_access_environment='staging'")
            cur.execute(
                "SET LOCAL civic.runtime_access_approval="
                "'I_APPROVE_CIVIC_STAGING_RUNTIME_ACCESS'"
            )
            with self.assertRaisesRegex(Exception, 'SYNTHETIC_ACCOUNTS_REQUIRED'):
                cur.execute(ACCESS)
            cur.execute('ROLLBACK')
            cur.execute("""
                SELECT has_table_privilege('demos_staging_runtime',
                  'public.notifiche_preferenze','SELECT')
            """)
            self.assertEqual(cur.fetchone(), (False,))


if __name__ == '__main__':
    unittest.main()
