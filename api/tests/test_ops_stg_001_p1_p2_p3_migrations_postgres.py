"""Exercise P1/P2/P3 on disposable, loopback-only PostgreSQL 16 in GitHub CI.

Never connect to Render, Demos-Staging or Supabase production. No external
credentials, personal records, or persistent services are used.
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
STAGING_HASH = "0cbb6ace68a9f11956904e2a37898ec8"
SYNTHETIC_ID = "00000000-0000-4000-8000-00000000cafe"
WRONG_ID = "11111111-1111-4111-8111-111111111111"
SYNTHETIC_HASH = hashlib.md5(SYNTHETIC_ID.encode("ascii")).hexdigest()
MIGRATIONS = (
    ("P1", "ops_stg_001_p1_routes_20261103.sql", (
        "active_sessions", "ice", "comunicazioni", "unita_elettorale",
        "candidati", "political_candidacies", "political_mandates",
        "parlamento", "votazioni_parlamento"
    ), 114, 29, 48),
    ("P2", "ops_stg_001_p2_opinion_referendum_parliament_20261103.sql", (
        "opinioni_domande", "voti_referendum_abrogativi",
        "notifiche_voti_parlamento", "voti_camera"
    ), 31, 14, 23),
    ("P3", "ops_stg_001_p3_ballots_notifications_segnalazioni_20261103.sql", (
        "civic_ballots", "civic_ballot_positions",
        "notifiche_avvistamenti", "notifiche_comunali",
        "notifiche_voti_comuni", "political_opinion_notifications",
        "segnalazioni"
    ), 78, 33, 22),
)
USER_A = "00000000-0000-4000-8000-000000000301"
USER_B = "00000000-0000-4000-8000-000000000302"
PROCESS = "00000000-0000-4000-8000-00000000b001"


@unittest.skipUnless(psycopg2 is not None and os.getenv("CIVIC_TEST_DATABASE_URL"),
                     "Dedicated ephemeral civic_ci PostgreSQL required")
class P1P2P3StagingMigrationsPostgresTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        url = require_ephemeral_civic_database_url(os.environ["CIVIC_TEST_DATABASE_URL"])
        if url == os.getenv("DATABASE_URL"):
            raise RuntimeError("REFUSE_SHARED_DATABASE_URL")
        cls.conn = psycopg2.connect(url)
        cls.conn.autocommit = True
        with cls.conn.cursor() as cur:
            for role in ("anon", "authenticated", "demos_staging_runtime"):
                cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (role,))
                if cur.fetchone() is None:
                    cur.execute("CREATE ROLE " + role + (
                        " LOGIN NOINHERIT" if role == "demos_staging_runtime" else " NOLOGIN"
                    ))
            # Deliberately minimal synthetic upstream tables: only the FK targets
            # needed for P1–P3. These are not copies of real users or processes.
            cur.execute("CREATE TABLE public.users (id uuid PRIMARY KEY)")
            cur.execute("CREATE TABLE public.eventi (id uuid PRIMARY KEY)")
            cur.execute("CREATE TABLE public.civic_processes (id uuid PRIMARY KEY)")
            cur.execute("INSERT INTO public.users(id) VALUES (%s), (%s)", (USER_A, USER_B))
            cur.execute("INSERT INTO public.civic_processes(id) VALUES (%s)", (PROCESS,))
            cur.execute("""CREATE TABLE public.civic_runtime_identity
                           (id smallint PRIMARY KEY, db_identity uuid NOT NULL)""")
            cur.execute("INSERT INTO public.civic_runtime_identity VALUES (1,%s)", (WRONG_ID,))
            cur.execute("""CREATE TABLE public.civic_push_delivery_guard
                           (id smallint PRIMARY KEY, blocked boolean NOT NULL)""")
            cur.execute("INSERT INTO public.civic_push_delivery_guard VALUES (1,TRUE)")

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()  # Runner discards civic_ci PostgreSQL entirely.

    def _migration(self, filename):
        sql = (ROOT / "api" / "database" / "staging" / filename).read_text(encoding="utf-8")
        self.assertEqual(sql.count(STAGING_HASH), 1, filename)
        self.assertNotIn(SYNTHETIC_HASH, sql, "CI identifier must not enter repository SQL")
        return sql.replace(STAGING_HASH, SYNTHETIC_HASH)

    def _count(self, cur, names, kind):
        if kind == "columns":
            cur.execute("""SELECT count(*) FROM information_schema.columns
                           WHERE table_schema='public' AND table_name=ANY(%s)""", (list(names),))
        elif kind == "constraints":
            cur.execute("""SELECT count(*) FROM pg_constraint
                           WHERE conrelid=ANY(%s::regclass[])""",
                        (["public." + n for n in names],))
        elif kind == "indexes":
            cur.execute("""SELECT count(*) FROM pg_indexes
                           WHERE schemaname='public' AND tablename=ANY(%s)""", (list(names),))
        return cur.fetchone()[0]

    def test_all_migrations_guards_schema_privileges_and_synthetic_ballots(self):
        with self.conn.cursor() as cur:
            for phase, filename, names, expected_cols, expected_constraints, expected_indexes in MIGRATIONS:
                sql = self._migration(filename)
                if phase == "P3":
                    # Mandatory blocked-delivery gate must reject unsafe startup
                    # even with the correct database identity.
                    cur.execute("UPDATE public.civic_push_delivery_guard SET blocked=FALSE WHERE id=1")
                else:
                    cur.execute("UPDATE public.civic_runtime_identity SET db_identity=%s WHERE id=1",
                                (WRONG_ID,))
                with self.assertRaises(psycopg2.Error, msg=phase + " must fail closed"):
                    cur.execute(sql)
                cur.execute("ROLLBACK")
                for name in names:
                    cur.execute("SELECT to_regclass(%s)", ("public." + name,))
                    self.assertIsNone(cur.fetchone()[0], "No partial DDL after failed " + phase)

                cur.execute("UPDATE public.civic_runtime_identity SET db_identity=%s WHERE id=1",
                            (SYNTHETIC_ID,))
                cur.execute("UPDATE public.civic_push_delivery_guard SET blocked=TRUE WHERE id=1")
                cur.execute(sql)
                self.assertEqual(self._count(cur, names, "columns"), expected_cols, phase)
                self.assertEqual(self._count(cur, names, "constraints"), expected_constraints, phase)
                self.assertEqual(self._count(cur, names, "indexes"), expected_indexes, phase)
                for name in names:
                    cur.execute("""SELECT relrowsecurity FROM pg_class
                                   WHERE oid=%s::regclass""", ("public." + name,))
                    self.assertEqual(cur.fetchone(), (True,), name)
                    cur.execute("SELECT count(*) FROM public." + name)
                    self.assertEqual(cur.fetchone(), (0,), name)
                    for role in ("anon", "authenticated"):
                        cur.execute("""SELECT has_table_privilege(%s,%s,'SELECT,INSERT,UPDATE,DELETE')""",
                                    (role, "public." + name))
                        self.assertEqual(cur.fetchone(), (False,), role + "/" + name)

                # A second run must be refused instead of overwriting schema.
                with self.assertRaises(psycopg2.Error, msg=phase + " repeat must be refused"):
                    cur.execute(sql)
                cur.execute("ROLLBACK")

            # Verify real ballot constraints using only synthetic fixture rows.
            # The entire fixture is intentionally rolled back.
            cur.execute("BEGIN")
            cur.execute("""INSERT INTO public.civic_ballots
                (civic_process_id,ballot_kind,question_text,yes_meaning,no_meaning,
                 opens_at,closes_at,timezone,source_id,source_url)
                VALUES (%s,'referendum','Synthetic question','Yes','No',
                        '2027-01-01T00:00:00Z','2027-02-01T00:00:00Z',
                        'Europe/Rome','synthetic-only','https://example.invalid/fixture')
                RETURNING id""", (PROCESS,))
            ballot = cur.fetchone()[0]
            for user, choice in ((USER_A, "YES"), (USER_B, "NO")):
                cur.execute("""INSERT INTO public.civic_ballot_positions
                               (civic_ballot_id,user_id,choice) VALUES (%s,%s,%s)""",
                            (ballot, user, choice))
            cur.execute("SELECT count(*) FROM public.civic_ballot_positions")
            self.assertEqual(cur.fetchone(), (2,))
            for choice, user in (("MAYBE", USER_A), ("ABSTAIN", USER_A)):
                cur.execute("SAVEPOINT invalid_or_duplicate")
                with self.assertRaises(psycopg2.Error) as blocked:
                    cur.execute("""INSERT INTO public.civic_ballot_positions
                                   (civic_ballot_id,user_id,choice) VALUES (%s,%s,%s)""",
                                (ballot, user, choice))
                self.assertIn(blocked.exception.pgcode, ("23514", "23505"))
                cur.execute("ROLLBACK TO SAVEPOINT invalid_or_duplicate")
            cur.execute("ROLLBACK")
            cur.execute("SELECT count(*) FROM public.civic_ballot_positions")
            self.assertEqual(cur.fetchone(), (0,))
            cur.execute("SELECT blocked FROM public.civic_push_delivery_guard WHERE id=1")
            self.assertEqual(cur.fetchone(), (True,))


    def test_z_explicit_ballot_acl_requires_approval_and_only_exposes_fixtures(self):
        acl_path = ROOT / "api/database/staging/ops_stg_001_p3_synthetic_ballot_acl_20261103.sql"
        acl_original = acl_path.read_text(encoding="utf-8")
        self.assertEqual(acl_original.count(STAGING_HASH), 1)
        acl = acl_original.replace(STAGING_HASH, SYNTHETIC_HASH)
        with self.conn.cursor() as cur:
            # No implicit opt-in, even on an otherwise valid synthetic database.
            with self.assertRaisesRegex(psycopg2.Error, "P3_BALLOT_ACL_APPROVAL_REQUIRED"):
                cur.execute(acl)
            cur.execute("ROLLBACK")

            cur.execute("UPDATE public.civic_runtime_identity SET db_identity=%s WHERE id=1",
                        (WRONG_ID,))
            cur.execute("BEGIN")
            cur.execute("SET LOCAL civic.p3_runtime_approval='I_APPROVE_P3_SYNTHETIC_BALLOT_ACL'")
            with self.assertRaisesRegex(psycopg2.Error, "P3_BALLOT_ACL_WRONG_DATABASE"):
                cur.execute(acl)
            cur.execute("ROLLBACK")
            cur.execute("UPDATE public.civic_runtime_identity SET db_identity=%s WHERE id=1",
                        (SYNTHETIC_ID,))

            cur.execute("UPDATE public.civic_push_delivery_guard SET blocked=FALSE WHERE id=1")
            cur.execute("BEGIN")
            cur.execute("SET LOCAL civic.p3_runtime_approval='I_APPROVE_P3_SYNTHETIC_BALLOT_ACL'")
            with self.assertRaisesRegex(psycopg2.Error, "P3_BALLOT_ACL_DELIVERY_UNBLOCKED"):
                cur.execute(acl)
            cur.execute("ROLLBACK")
            cur.execute("UPDATE public.civic_push_delivery_guard SET blocked=TRUE WHERE id=1")

            for table in ("civic_ballots", "civic_ballot_positions"):
                cur.execute("SELECT has_table_privilege('demos_staging_runtime',%s,'SELECT,INSERT,UPDATE,DELETE')",
                            ("public." + table,))
                self.assertEqual(cur.fetchone(), (False,))

            cur.execute("BEGIN")
            cur.execute("SET LOCAL civic.p3_runtime_approval='I_APPROVE_P3_SYNTHETIC_BALLOT_ACL'")
            cur.execute(acl)
            cur.execute("COMMIT")

            for name, operations in (
                ("civic_ballots", ("SELECT",)),
                ("civic_ballot_positions", ("SELECT", "INSERT", "UPDATE")),
            ):
                for action in ("SELECT", "INSERT", "UPDATE", "DELETE"):
                    cur.execute("SELECT has_table_privilege('demos_staging_runtime',%s,%s)",
                                ("public." + name, action))
                    # UPDATE is intentionally granted at COLUMN scope only.
                    permitted = action in operations and action != "UPDATE"
                    self.assertEqual(cur.fetchone()[0], permitted, name + "/" + action)
                if name == "civic_ballot_positions":
                    for column, allowed in (
                        ("choice", True), ("updated_at", True),
                        ("user_id", False), ("civic_ballot_id", False),
                        ("created_at", False)
                    ):
                        cur.execute("""SELECT has_column_privilege(
                             'demos_staging_runtime','public.civic_ballot_positions',
                             %s,'UPDATE')""", (column,))
                        self.assertEqual(cur.fetchone()[0], allowed, column)
                for role in ("anon", "authenticated"):
                    cur.execute("SELECT has_table_privilege(%s,%s,'SELECT,INSERT,UPDATE,DELETE')",
                                (role, "public." + name))
                    self.assertEqual(cur.fetchone(), (False,))

            # The test inserts a legitimate synthetic referendum and a second
            # synthetic row with an unapproved source prefix (must be invisible).
            cur.execute("BEGIN")
            # One ballot per civic process is an actual production constraint.
            # Create another disposable synthetic process to test RLS denial.
            other_process = "00000000-0000-4000-8000-00000000b002"
            cur.execute("INSERT INTO public.civic_processes(id) VALUES (%s)", (other_process,))
            ballot_ids = []
            for source, process_id in (
                ("staging-fixture-official-001", PROCESS),
                ("other-source-test-002", other_process),
            ):
                cur.execute("""INSERT INTO public.civic_ballots
                    (civic_process_id,ballot_kind,question_text,yes_meaning,no_meaning,
                     opens_at,closes_at,timezone,source_id,source_url)
                    VALUES (%s,'referendum','Synthetic question','Yes','No',
                            '2027-01-01T00:00:00Z','2027-02-01T00:00:00Z',
                            'Europe/Rome',%s,'https://example.invalid/fixture')
                    RETURNING id""", (process_id, source))
                ballot_ids.append(cur.fetchone()[0])

            cur.execute("SET LOCAL ROLE demos_staging_runtime")
            # Route uses a reader lock on the ballot. A FOR UPDATE here would
            # require an unnecessary ballot UPDATE privilege and fail closed.
            cur.execute("SELECT id FROM public.civic_ballots WHERE id=%s FOR SHARE",
                        (ballot_ids[0],))
            self.assertEqual(cur.fetchone()[0], ballot_ids[0])
            cur.execute("SELECT id FROM public.civic_ballots")
            self.assertEqual([row[0] for row in cur.fetchall()], [ballot_ids[0]])
            cur.execute("""INSERT INTO public.civic_ballot_positions
                           (civic_ballot_id,user_id,choice) VALUES (%s,%s,'YES')""",
                        (ballot_ids[0], USER_A))
            cur.execute("SELECT user_id,choice FROM public.civic_ballot_positions")
            visible = cur.fetchall()
            self.assertEqual(len(visible), 1)
            self.assertEqual(visible[0][1], "YES")
            # Match the actual INSERT/ON CONFLICT DO UPDATE vote SQL, including
            # row locking, but do not need the unrelated cooldown tables here.
            cur.execute("""SELECT choice FROM public.civic_ballot_positions
                           WHERE civic_ballot_id=%s AND user_id=%s FOR UPDATE""",
                        (ballot_ids[0], USER_A))
            self.assertEqual(cur.fetchone(), ("YES",))
            cur.execute("""INSERT INTO public.civic_ballot_positions
                  (civic_ballot_id,user_id,choice,created_at,updated_at)
                  VALUES (%s,%s,'NO',NOW(),NOW())
                  ON CONFLICT (civic_ballot_id,user_id)
                  DO UPDATE SET choice=EXCLUDED.choice,updated_at=NOW()""",
                (ballot_ids[0], USER_A))
            cur.execute("""SELECT choice FROM public.civic_ballot_positions
                          WHERE civic_ballot_id=%s AND user_id=%s""",
                        (ballot_ids[0], USER_A))
            self.assertEqual(cur.fetchone(), ("NO",))
            # Only choice and updated_at may be updated, never user/ballot IDs.
            cur.execute("SAVEPOINT forbidden_owner_update")
            with self.assertRaises(psycopg2.Error) as rejected:
                cur.execute("""UPDATE public.civic_ballot_positions
                    SET user_id=%s WHERE civic_ballot_id=%s AND user_id=%s""",
                    (USER_B, ballot_ids[0], USER_A))
            self.assertEqual(rejected.exception.pgcode, "42501")
            cur.execute("ROLLBACK TO SAVEPOINT forbidden_owner_update")

            cur.execute("SAVEPOINT invalid_ballot_source")
            with self.assertRaises(psycopg2.Error) as rejected:
                cur.execute("""INSERT INTO public.civic_ballot_positions
                    (civic_ballot_id,user_id,choice) VALUES (%s,%s,'NO')""",
                    (ballot_ids[1], USER_B))
            self.assertEqual(rejected.exception.pgcode, "42501")
            cur.execute("ROLLBACK TO SAVEPOINT invalid_ballot_source")

            cur.execute("SAVEPOINT outside_fixture_user")
            with self.assertRaises(psycopg2.Error) as rejected:
                cur.execute("""INSERT INTO public.civic_ballot_positions
                    (civic_ballot_id,user_id,choice) VALUES (%s,%s,'NO')""",
                    (ballot_ids[0], "33333333-3333-4333-8333-333333333333"))
            self.assertEqual(rejected.exception.pgcode, "42501")
            cur.execute("ROLLBACK TO SAVEPOINT outside_fixture_user")
            cur.execute("ROLLBACK")

            cur.execute("SELECT count(*) FROM public.civic_ballots")
            self.assertEqual(cur.fetchone(), (0,))
            cur.execute("SELECT count(*) FROM public.civic_ballot_positions")
            self.assertEqual(cur.fetchone(), (0,))
            cur.execute("SELECT blocked FROM public.civic_push_delivery_guard WHERE id=1")
            self.assertEqual(cur.fetchone(), (True,))

            # Applying an ACL twice is never a no-op: it must be rejected.
            cur.execute("BEGIN")
            cur.execute("SET LOCAL civic.p3_runtime_approval='I_APPROVE_P3_SYNTHETIC_BALLOT_ACL'")
            with self.assertRaisesRegex(psycopg2.Error, "P3_BALLOT_ACL_POLICIES_ALREADY_EXIST"):
                cur.execute(acl)
            cur.execute("ROLLBACK")


if __name__ == "__main__":
    unittest.main()
