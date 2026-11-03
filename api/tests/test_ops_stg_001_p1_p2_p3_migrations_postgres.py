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
    ("P4", "ops_stg_001_p4_preference_cooldowns_20261103.sql", (
        "preference_change_cooldowns",
    ), 3, 1, 2),
    ("P5", "ops_stg_001_p5_forecast_snapshots_20261103.sql", (
        "civic_ballot_forecast_snapshots",
    ), 9, 7, 2),
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
        expected_major = int(os.environ.get("CIVIC_CI_POSTGRES_MAJOR", "0"))
        if cls.conn.server_version // 10000 != expected_major or expected_major not in (16, 17):
            cls.conn.close()
            raise RuntimeError("CIVIC_CI_POSTGRES_ENGINE_MISMATCH")
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
            # The role can read an eligible ballot without an UPDATE grant.
            # The vote's INSERT later checks opening time in its own statement.
            cur.execute("SELECT id FROM public.civic_ballots WHERE id=%s",
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


    def test_zz_fixture_cooldown_acl_is_restricted_and_upsert_works(self):
        """Exercise the actual preferenceCooldownService upsert on temporary PG16."""
        file_path = ROOT / "api/database/staging/ops_stg_001_p4_synthetic_cooldown_acl_20261103.sql"
        original = file_path.read_text(encoding="utf-8")
        self.assertEqual(original.count(STAGING_HASH), 1)
        acl = original.replace(STAGING_HASH, SYNTHETIC_HASH)
        with self.conn.cursor() as cur:
            with self.assertRaisesRegex(psycopg2.Error, "P4_COOLDOWN_ACL_APPROVAL_REQUIRED"):
                cur.execute(acl)
            cur.execute("ROLLBACK")
            cur.execute("SELECT count(*) FROM public.preference_change_cooldowns")
            self.assertEqual(cur.fetchone(), (0,))

            cur.execute("UPDATE public.civic_runtime_identity SET db_identity=%s WHERE id=1",
                        (WRONG_ID,))
            cur.execute("BEGIN")
            cur.execute("SET LOCAL civic.p4_runtime_approval='I_APPROVE_P4_SYNTHETIC_COOLDOWN_ACL'")
            with self.assertRaisesRegex(psycopg2.Error, "P4_COOLDOWN_ACL_WRONG_DATABASE"):
                cur.execute(acl)
            cur.execute("ROLLBACK")
            cur.execute("UPDATE public.civic_runtime_identity SET db_identity=%s WHERE id=1",
                        (SYNTHETIC_ID,))

            cur.execute("UPDATE public.civic_push_delivery_guard SET blocked=FALSE WHERE id=1")
            cur.execute("BEGIN")
            cur.execute("SET LOCAL civic.p4_runtime_approval='I_APPROVE_P4_SYNTHETIC_COOLDOWN_ACL'")
            with self.assertRaisesRegex(psycopg2.Error, "P4_COOLDOWN_ACL_DELIVERY_UNBLOCKED"):
                cur.execute(acl)
            cur.execute("ROLLBACK")
            cur.execute("UPDATE public.civic_push_delivery_guard SET blocked=TRUE WHERE id=1")

            cur.execute("""SELECT has_table_privilege('demos_staging_runtime',
                        'public.preference_change_cooldowns','SELECT,INSERT,UPDATE,DELETE')""")
            self.assertEqual(cur.fetchone(), (False,))
            cur.execute("BEGIN")
            cur.execute("SET LOCAL civic.p4_runtime_approval='I_APPROVE_P4_SYNTHETIC_COOLDOWN_ACL'")
            cur.execute(acl)
            cur.execute("COMMIT")
            for verb, allowed in (
                ("SELECT", True), ("INSERT", True),
                ("UPDATE", False), ("DELETE", False)
            ):
                cur.execute("""SELECT has_table_privilege(
                    'demos_staging_runtime','public.preference_change_cooldowns',%s)""",
                    (verb,))
                self.assertEqual(cur.fetchone()[0], allowed, verb)
            for col, allowed in (
                ("last_changed_at", True), ("user_id", False), ("scope", False)
            ):
                cur.execute("""SELECT has_column_privilege(
                    'demos_staging_runtime','public.preference_change_cooldowns',%s,'UPDATE')""",
                    (col,))
                self.assertEqual(cur.fetchone()[0], allowed, col)
            for role in ("anon", "authenticated"):
                cur.execute("""SELECT has_table_privilege(%s,
                    'public.preference_change_cooldowns','SELECT,INSERT,UPDATE,DELETE')""",
                    (role,))
                self.assertEqual(cur.fetchone(), (False,))

            cur.execute("BEGIN")
            other_process = "00000000-0000-4000-8000-00000000b003"
            cur.execute("INSERT INTO public.civic_processes(id) VALUES (%s)",
                        (other_process,))
            fixture_ballots = []
            for process_id, name in (
                (PROCESS, "staging-fixture-cooldown-001"),
                (other_process, "unrelated-test-cooldown-002")
            ):
                cur.execute("""INSERT INTO public.civic_ballots
                    (civic_process_id,ballot_kind,question_text,yes_meaning,no_meaning,
                     opens_at,closes_at,timezone,source_id,source_url)
                    VALUES (%s,'referendum','Synthetic question','Yes','No',
                            '2027-01-01T00:00:00Z','2027-02-01T00:00:00Z',
                            'Europe/Rome',%s,'https://example.invalid/fixture')
                    RETURNING id""", (process_id, name))
                fixture_ballots.append(cur.fetchone()[0])
            allowed_scope = "referendum-vote:" + str(fixture_ballots[0])
            blocked_scope = "referendum-vote:" + str(fixture_ballots[1])

            cur.execute("SET LOCAL ROLE demos_staging_runtime")
            cur.execute("SELECT count(*) FROM public.preference_change_cooldowns")
            self.assertEqual(cur.fetchone(), (0,))
            cur.execute("""INSERT INTO public.preference_change_cooldowns
                (user_id, scope, last_changed_at) VALUES (%s,%s,%s)
                ON CONFLICT (user_id,scope)
                DO UPDATE SET last_changed_at=EXCLUDED.last_changed_at""",
                (USER_A, allowed_scope, "2027-01-01T12:00:00Z"))
            cur.execute("""INSERT INTO public.preference_change_cooldowns
                (user_id, scope, last_changed_at) VALUES (%s,%s,%s)
                ON CONFLICT (user_id,scope)
                DO UPDATE SET last_changed_at=EXCLUDED.last_changed_at""",
                (USER_A, allowed_scope, "2027-01-01T13:00:00Z"))
            cur.execute("""SELECT last_changed_at FROM public.preference_change_cooldowns
                           WHERE user_id=%s AND scope=%s""",
                        (USER_A, allowed_scope))
            self.assertEqual(cur.fetchone()[0].hour, 13)
            cur.execute("SELECT count(*) FROM public.preference_change_cooldowns")
            self.assertEqual(cur.fetchone(), (1,))

            for wrong_user, wrong_scope in (
                (USER_A, blocked_scope),
                (USER_A, "referendum-vote:00000000-0000-4000-8000-000000009999"),
                (USER_A, "preferiti:all"),
                ("33333333-3333-4333-8333-333333333333", allowed_scope)
            ):
                cur.execute("SAVEPOINT rejected_cooldown")
                with self.assertRaises(psycopg2.Error) as err:
                    cur.execute("""INSERT INTO public.preference_change_cooldowns
                                   (user_id, scope, last_changed_at)
                                   VALUES (%s,%s,NOW())""", (wrong_user, wrong_scope))
                self.assertEqual(err.exception.pgcode, "42501")
                cur.execute("ROLLBACK TO SAVEPOINT rejected_cooldown")

            cur.execute("SAVEPOINT forbidden_scope_edit")
            with self.assertRaises(psycopg2.Error) as err:
                cur.execute("""UPDATE public.preference_change_cooldowns
                               SET scope=%s WHERE user_id=%s AND scope=%s""",
                            (blocked_scope, USER_A, allowed_scope))
            self.assertEqual(err.exception.pgcode, "42501")
            cur.execute("ROLLBACK TO SAVEPOINT forbidden_scope_edit")

            cur.execute("SAVEPOINT forbidden_delete")
            with self.assertRaises(psycopg2.Error) as err:
                cur.execute("DELETE FROM public.preference_change_cooldowns")
            self.assertEqual(err.exception.pgcode, "42501")
            cur.execute("ROLLBACK TO SAVEPOINT forbidden_delete")
            cur.execute("ROLLBACK")

            cur.execute("SELECT count(*) FROM public.preference_change_cooldowns")
            self.assertEqual(cur.fetchone(), (0,))
            cur.execute("SELECT count(*) FROM public.civic_ballots")
            self.assertEqual(cur.fetchone(), (0,))
            cur.execute("SELECT blocked FROM public.civic_push_delivery_guard WHERE id=1")
            self.assertEqual(cur.fetchone(), (True,))
            cur.execute("BEGIN")
            cur.execute("SET LOCAL civic.p4_runtime_approval='I_APPROVE_P4_SYNTHETIC_COOLDOWN_ACL'")
            with self.assertRaisesRegex(psycopg2.Error, "P4_COOLDOWN_ACL_ALREADY_CONFIGURED"):
                cur.execute(acl)
            cur.execute("ROLLBACK")


    def test_zzz_parallel_first_votes_are_serialized_before_cooldown_check(self):
        """Two real PG sessions cannot both read an unrecorded first vote.

        Transaction-scoped advisory lock is acquired before the first SELECT
        of the existing ballot position and cooldown record. The second
        transaction must see the first one's committed vote/timestamp.
        """
        url = require_ephemeral_civic_database_url(os.environ["CIVIC_TEST_DATABASE_URL"])
        ballot_id = None
        first = second = None
        with self.conn.cursor() as cur:
            cur.execute("""INSERT INTO public.civic_ballots
                (civic_process_id,ballot_kind,question_text,yes_meaning,no_meaning,
                 opens_at,closes_at,timezone,source_id,source_url)
                VALUES (%s,'referendum','Concurrent synthetic fixture','Yes','No',
                        '2027-01-01T00:00:00Z','2027-02-01T00:00:00Z',
                        'Europe/Rome','staging-fixture-concurrent-001',
                        'https://example.invalid/concurrency-fixture')
                RETURNING id""", (PROCESS,))
            ballot_id = cur.fetchone()[0]
        scope = "referendum-vote:" + str(ballot_id)
        try:
            first = psycopg2.connect(url)
            second = psycopg2.connect(url)
            with first.cursor() as a, second.cursor() as b:
                a.execute("SET LOCAL ROLE demos_staging_runtime")
                b.execute("SET LOCAL ROLE demos_staging_runtime")
                a.execute("""SELECT pg_advisory_xact_lock(
                     hashtext(%s::text),hashtext(%s::text))""",
                          (USER_A, str(ballot_id)))
                a.execute("""INSERT INTO public.civic_ballot_positions
                      (civic_ballot_id,user_id,choice)
                      VALUES (%s,%s,'YES')""", (ballot_id, USER_A))
                a.execute("""INSERT INTO public.preference_change_cooldowns
                      (user_id,scope,last_changed_at)
                      VALUES (%s,%s,NOW())""", (USER_A, scope))

                # An unrelated user should NOT block on the first user's lock.
                b.execute("SET LOCAL lock_timeout='250ms'")
                b.execute("""SELECT pg_advisory_xact_lock(
                     hashtext(%s::text),hashtext(%s::text))""",
                          (USER_B, str(ballot_id)))
                second.rollback()  # release unrelated lock
                b.execute("SET LOCAL ROLE demos_staging_runtime")
                b.execute("SET LOCAL lock_timeout='250ms'")
                # Same user and ballot MUST block; exception is lock timeout.
                with self.assertRaises(psycopg2.Error) as rejected:
                    b.execute("""SELECT pg_advisory_xact_lock(
                         hashtext(%s::text),hashtext(%s::text))""",
                              (USER_A, str(ballot_id)))
                self.assertEqual(rejected.exception.pgcode, "55P03")
                second.rollback()
                first.commit()  # both vote and cooldown become visible together

                b.execute("SET LOCAL ROLE demos_staging_runtime")
                b.execute("SET LOCAL lock_timeout='750ms'")
                b.execute("""SELECT pg_advisory_xact_lock(
                     hashtext(%s::text),hashtext(%s::text))""",
                          (USER_A, str(ballot_id)))
                b.execute("""SELECT choice FROM public.civic_ballot_positions
                      WHERE civic_ballot_id=%s AND user_id=%s""",
                          (ballot_id, USER_A))
                self.assertEqual(b.fetchone(), ("YES",))
                b.execute("""SELECT last_changed_at FROM public.preference_change_cooldowns
                      WHERE user_id=%s AND scope=%s""", (USER_A, scope))
                self.assertIsNotNone(b.fetchone()[0],
                    "Second transaction must see the first committed cooldown")
                second.rollback()
        finally:
            if first:
                first.rollback()
                first.close()
            if second:
                second.rollback()
                second.close()
            if ballot_id is not None:
                # No test rows may persist even inside the disposable CI DB.
                with self.conn.cursor() as cleanup:
                    cleanup.execute("""DELETE FROM public.preference_change_cooldowns
                           WHERE user_id=%s AND scope=%s""", (USER_A, scope))
                    cleanup.execute("""DELETE FROM public.civic_ballot_positions
                           WHERE civic_ballot_id=%s""", (ballot_id,))
                    cleanup.execute("DELETE FROM public.civic_ballots WHERE id=%s",
                                    (ballot_id,))
        with self.conn.cursor() as check:
            check.execute("""SELECT count(*) FROM public.civic_ballot_positions
                             WHERE civic_ballot_id=%s""", (ballot_id,))
            self.assertEqual(check.fetchone(), (0,))
            check.execute("""SELECT count(*) FROM public.preference_change_cooldowns
                             WHERE scope=%s""", (scope,))
            self.assertEqual(check.fetchone(), (0,))



    def test_x_actual_snapshot_aggregation_counts_distinct_synthetic_voters(self):
        """Exercise the production snapshot SELECT on ten ephemeral PG voters.

        This proves SQL counting and uniqueness, not app E2E with staging ACL:
        Demos-Staging deliberately permits only two fixture identities.
        """
        source = (ROOT / "api" / "services" /
                  "referendumForecastSnapshotService.js").read_text(encoding="utf-8")
        self.assertIn("const MIN_PUBLIC_RESPONSES = 10;", source)
        self.assertIn("if (total < MIN_PUBLIC_RESPONSES)", source)
        statement = source.split("const aggregates = await pool.query(", 1)[1]
        aggregate_sql = statement.split(chr(96), 2)[1]
        self.assertIn("COUNT(p.user_id)::int AS total_responses", aggregate_sql)
        self.assertIn("LEFT JOIN civic_ballot_positions p", aggregate_sql)
        # Only translate the Node pg bind syntax for psycopg2; same SQL body.
        aggregate_sql = aggregate_sql.replace("$1::int", "%s::int")
        users = [USER_A, USER_B] + [
            f"00000000-0000-4000-8000-{index:012x}"
            for index in range(0x303, 0x30b)
        ]
        self.assertEqual(len(users), len(set(users)))
        self.assertEqual(len(users), 10)
        with self.conn.cursor() as cur:
            try:
                cur.execute("BEGIN")
                for user in users[2:]:
                    cur.execute("INSERT INTO public.users(id) VALUES (%s)", (user,))
                cur.execute("""INSERT INTO public.civic_ballots
                    (civic_process_id,ballot_kind,question_text,yes_meaning,no_meaning,
                     status,opens_at,closes_at,timezone,source_id,source_url)
                    VALUES (%s,'referendum','CI ten-voter aggregate','Yes','No',
                            'scheduled',NOW()+INTERVAL '30 days',
                            NOW()+INTERVAL '60 days','Europe/Rome',
                            'staging-fixture-ten-voters',
                            'https://example.invalid/ten-voter-fixture')
                    RETURNING id""", (PROCESS,))
                ballot_id = cur.fetchone()[0]

                def read_counts():
                    cur.execute(aggregate_sql, (730,))
                    matched = [row for row in cur.fetchall() if row[0] == ballot_id]
                    self.assertEqual(len(matched), 1)
                    # Returned columns: ballot ID, opening time, total, YES, NO, ABSTAIN.
                    return tuple(matched[0][2:])

                for user, choice in zip(users[:9], ["YES"] * 6 + ["NO"] * 3):
                    cur.execute("""INSERT INTO public.civic_ballot_positions
                        (civic_ballot_id,user_id,choice) VALUES (%s,%s,%s)""",
                        (ballot_id, user, choice))
                self.assertEqual(read_counts(), (9, 6, 3, 0))
                # Nine distinct positions must remain below the published minimum.
                cur.execute("""INSERT INTO public.civic_ballot_positions
                    (civic_ballot_id,user_id,choice) VALUES (%s,%s,'ABSTAIN')""",
                    (ballot_id, users[9]))
                self.assertEqual(read_counts(), (10, 6, 3, 1))
                cur.execute("""SELECT COUNT(DISTINCT user_id)
                    FROM public.civic_ballot_positions
                    WHERE civic_ballot_id=%s""", (ballot_id,))
                self.assertEqual(cur.fetchone(), (10,))

                # Rewriting a choice must not manufacture an eleventh voter.
                cur.execute("""INSERT INTO public.civic_ballot_positions
                    (civic_ballot_id,user_id,choice) VALUES (%s,%s,'NO')
                    ON CONFLICT (civic_ballot_id,user_id)
                    DO UPDATE SET choice=EXCLUDED.choice""",
                    (ballot_id, users[0]))
                self.assertEqual(read_counts(), (10, 5, 4, 1))

                # A real aggregate may be inserted only at the privacy threshold;
                # no individual user identifier enters the snapshot row.
                cur.execute("""INSERT INTO public.civic_ballot_forecast_snapshots
                    (civic_ballot_id,bucket_start,total_responses,
                     yes_count,no_count,abstain_count)
                    VALUES (%s,NOW(),10,5,4,1)""", (ballot_id,))
                cur.execute("""SELECT total_responses,yes_count,no_count,abstain_count
                    FROM public.civic_ballot_forecast_snapshots
                    WHERE civic_ballot_id=%s""", (ballot_id,))
                self.assertEqual(cur.fetchone(), (10, 5, 4, 1))
            finally:
                cur.execute("ROLLBACK")
            for table, expected in (
                ("users", 2), ("civic_ballots", 0),
                ("civic_ballot_positions", 0),
                ("civic_ballot_forecast_snapshots", 0)
            ):
                cur.execute("SELECT COUNT(*) FROM public." + table)
                self.assertEqual(cur.fetchone(), (expected,), table)
            cur.execute("SELECT blocked FROM public.civic_push_delivery_guard WHERE id=1")
            self.assertEqual(cur.fetchone(), (True,))

    def test_y_aggregate_snapshot_constraints_and_rollback(self):
        """P5 stores only counts; reject inconsistent totals and duplicates."""
        with self.conn.cursor() as cur:
            cur.execute("""SELECT count(*) FROM information_schema.columns
                WHERE table_schema='public'
                  AND table_name='civic_ballot_forecast_snapshots'
                  AND column_name IN ('user_id','email','choice','voter_id')""")
            self.assertEqual(cur.fetchone(), (0,))
            cur.execute("BEGIN")
            cur.execute("""INSERT INTO public.civic_ballots
                (civic_process_id,ballot_kind,question_text,yes_meaning,no_meaning,
                 opens_at,closes_at,timezone,source_id,source_url)
                VALUES (%s,'referendum','Synthetic aggregate test','Yes','No',
                        '2027-01-01T00:00:00Z','2027-02-01T00:00:00Z',
                        'Europe/Rome','staging-fixture-aggregate-001',
                        'https://example.invalid/aggregate-fixture')
                RETURNING id""", (PROCESS,))
            ballot_id = cur.fetchone()[0]
            snapshot_time = "2027-01-01T00:00:00Z"
            cur.execute("""INSERT INTO public.civic_ballot_forecast_snapshots
                (civic_ballot_id,bucket_start,total_responses,
                 yes_count,no_count,abstain_count,is_frozen)
                VALUES (%s,%s,10,6,3,1,TRUE)""",
                (ballot_id, snapshot_time))
            cur.execute("""SELECT total_responses,yes_count,no_count,abstain_count,is_frozen
                FROM public.civic_ballot_forecast_snapshots
                WHERE civic_ballot_id=%s""", (ballot_id,))
            self.assertEqual(cur.fetchone(), (10,6,3,1,True))

            for total, yes, no, abstain in ((11,6,3,1), (10,-1,10,1)):
                cur.execute("SAVEPOINT invalid_aggregate")
                with self.assertRaises(psycopg2.Error) as e:
                    cur.execute("""INSERT INTO public.civic_ballot_forecast_snapshots
                        (civic_ballot_id,bucket_start,total_responses,
                         yes_count,no_count,abstain_count)
                        VALUES (%s,'2027-01-02T00:00:00Z',%s,%s,%s,%s)""",
                        (ballot_id,total,yes,no,abstain))
                self.assertEqual(e.exception.pgcode, "23514")
                cur.execute("ROLLBACK TO SAVEPOINT invalid_aggregate")

            cur.execute("SAVEPOINT duplicate_bucket")
            with self.assertRaises(psycopg2.Error) as e:
                cur.execute("""INSERT INTO public.civic_ballot_forecast_snapshots
                    (civic_ballot_id,bucket_start,total_responses,
                     yes_count,no_count,abstain_count)
                    VALUES (%s,%s,10,6,3,1)""", (ballot_id,snapshot_time))
            self.assertEqual(e.exception.pgcode, "23505")
            cur.execute("ROLLBACK TO SAVEPOINT duplicate_bucket")
            cur.execute("ROLLBACK")

            cur.execute("SELECT count(*) FROM public.civic_ballot_forecast_snapshots")
            self.assertEqual(cur.fetchone(), (0,))
            cur.execute("SELECT count(*) FROM public.civic_ballots")
            self.assertEqual(cur.fetchone(), (0,))


    def test_zzzz_snapshot_acl_enforces_minimum_count_and_freeze(self):
        """Use SQL on ephemeral PG16; not a real capture with 10 voters."""
        path = ROOT / "api/database/staging/ops_stg_001_p5_synthetic_snapshot_acl_20261103.sql"
        original = path.read_text(encoding="utf-8")
        self.assertEqual(original.count(STAGING_HASH), 1)
        acl = original.replace(STAGING_HASH, SYNTHETIC_HASH)
        with self.conn.cursor() as cur:
            with self.assertRaisesRegex(psycopg2.Error, "P5_SNAPSHOT_ACL_APPROVAL_REQUIRED"):
                cur.execute(acl)
            cur.execute("ROLLBACK")
            cur.execute("UPDATE public.civic_runtime_identity SET db_identity=%s WHERE id=1",
                        (WRONG_ID,))
            cur.execute("BEGIN")
            cur.execute("SET LOCAL civic.p5_runtime_approval='I_APPROVE_P5_SYNTHETIC_SNAPSHOT_ACL'")
            with self.assertRaisesRegex(psycopg2.Error, "P5_SNAPSHOT_ACL_WRONG_DATABASE"):
                cur.execute(acl)
            cur.execute("ROLLBACK")
            cur.execute("UPDATE public.civic_runtime_identity SET db_identity=%s WHERE id=1",
                        (SYNTHETIC_ID,))
            cur.execute("UPDATE public.civic_push_delivery_guard SET blocked=FALSE WHERE id=1")
            cur.execute("BEGIN")
            cur.execute("SET LOCAL civic.p5_runtime_approval='I_APPROVE_P5_SYNTHETIC_SNAPSHOT_ACL'")
            with self.assertRaisesRegex(psycopg2.Error, "P5_SNAPSHOT_ACL_DELIVERY_UNBLOCKED"):
                cur.execute(acl)
            cur.execute("ROLLBACK")
            cur.execute("UPDATE public.civic_push_delivery_guard SET blocked=TRUE WHERE id=1")

            cur.execute("BEGIN")
            cur.execute("SET LOCAL civic.p5_runtime_approval='I_APPROVE_P5_SYNTHETIC_SNAPSHOT_ACL'")
            cur.execute(acl)
            cur.execute("COMMIT")
            for action, allowed in (
                ("SELECT", True), ("INSERT", True),
                ("UPDATE", False), ("DELETE", False)
            ):
                cur.execute("""SELECT has_table_privilege(
                  'demos_staging_runtime','public.civic_ballot_forecast_snapshots',%s)""",
                            (action,))
                self.assertEqual(cur.fetchone()[0], allowed, action)
            for col, allowed in (
                ("total_responses", True), ("yes_count", True),
                ("no_count", True), ("abstain_count", True),
                ("updated_at", True), ("civic_ballot_id", False),
                ("bucket_start", False), ("is_frozen", False),
                ("created_at", False)
            ):
                cur.execute("""SELECT has_column_privilege(
                  'demos_staging_runtime','public.civic_ballot_forecast_snapshots',
                  %s,'UPDATE')""", (col,))
                self.assertEqual(cur.fetchone()[0], allowed, col)
            for role in ("anon", "authenticated"):
                cur.execute("""SELECT has_table_privilege(%s,
                  'public.civic_ballot_forecast_snapshots',
                  'SELECT,INSERT,UPDATE,DELETE')""", (role,))
                self.assertEqual(cur.fetchone(), (False,))

            cur.execute("BEGIN")
            other_process = "00000000-0000-4000-8000-00000000b004"
            cur.execute("INSERT INTO public.civic_processes(id) VALUES (%s)", (other_process,))
            ballot_ids = []
            for process, source in (
                (PROCESS, "staging-fixture-aggregate-acl"),
                (other_process, "staging-fixture-other-process")
            ):
                cur.execute("""INSERT INTO public.civic_ballots
                  (civic_process_id,ballot_kind,question_text,yes_meaning,no_meaning,
                   opens_at,closes_at,timezone,source_id,source_url)
                  VALUES (%s,'referendum','Aggregate SQL test','Yes','No',
                          '2027-01-01T00:00:00Z','2027-02-01T00:00:00Z',
                          'Europe/Rome',%s,'https://example.invalid/fixture')
                  RETURNING id""", (process, source))
                ballot_ids.append(cur.fetchone()[0])
            ts = "2027-01-01T00:00:00Z"
            # Test read-side suppression independently of the INSERT policy:
            # privileged fixture setup can create a historical sub-threshold row
            # or a row for another process; neither may leak to the runtime role.
            hidden_cases = (
                (ballot_ids[0], "2027-01-03T00:00:00Z", 9, 5, 3, 1),
                (ballot_ids[1], "2027-01-04T00:00:00Z", 10, 6, 3, 1),
            )
            for ballot, bucket, total, yes, no, abstain in hidden_cases:
                cur.execute("""INSERT INTO public.civic_ballot_forecast_snapshots
                    (civic_ballot_id,bucket_start,total_responses,
                     yes_count,no_count,abstain_count)
                    VALUES (%s,%s,%s,%s,%s,%s)""",
                    (ballot, bucket, total, yes, no, abstain))
            cur.execute("SET LOCAL ROLE demos_staging_runtime")
            for ballot, bucket, *_ in hidden_cases:
                cur.execute("""SELECT total_responses
                    FROM public.civic_ballot_forecast_snapshots
                    WHERE civic_ballot_id=%s AND bucket_start=%s""",
                    (ballot, bucket))
                self.assertIsNone(cur.fetchone(),
                    "Runtime must not read snapshots below 10 or from other processes")
            cur.execute("""INSERT INTO public.civic_ballot_forecast_snapshots
                (civic_ballot_id,bucket_start,total_responses,yes_count,no_count,abstain_count)
                VALUES (%s,%s,10,6,3,1)""", (ballot_ids[0], ts))
            cur.execute("""INSERT INTO public.civic_ballot_forecast_snapshots
                (civic_ballot_id,bucket_start,total_responses,yes_count,no_count,abstain_count)
                VALUES (%s,%s,10,7,2,1)
                ON CONFLICT (civic_ballot_id,bucket_start) DO UPDATE SET
                  total_responses=EXCLUDED.total_responses,
                  yes_count=EXCLUDED.yes_count, no_count=EXCLUDED.no_count,
                  abstain_count=EXCLUDED.abstain_count,updated_at=NOW()
                WHERE civic_ballot_forecast_snapshots.is_frozen=FALSE""",
                        (ballot_ids[0], ts))
            cur.execute("""SELECT yes_count,no_count,abstain_count
                FROM public.civic_ballot_forecast_snapshots WHERE civic_ballot_id=%s""",
                        (ballot_ids[0],))
            self.assertEqual(cur.fetchone(), (7, 2, 1))

            for target, total, yes, no, abstain in (
                (ballot_ids[0], 9, 5, 3, 1),
                (ballot_ids[1], 10, 6, 3, 1)
            ):
                cur.execute("SAVEPOINT rejected_snapshot")
                with self.assertRaises(psycopg2.Error) as rejected:
                    cur.execute("""INSERT INTO public.civic_ballot_forecast_snapshots
                       (civic_ballot_id,bucket_start,total_responses,
                        yes_count,no_count,abstain_count)
                       VALUES (%s,'2027-01-02T00:00:00Z',%s,%s,%s,%s)""",
                                (target,total,yes,no,abstain))
                self.assertEqual(rejected.exception.pgcode, "42501")
                cur.execute("ROLLBACK TO SAVEPOINT rejected_snapshot")

            cur.execute("SAVEPOINT forbidden_freeze")
            with self.assertRaises(psycopg2.Error) as rejected:
                cur.execute("""UPDATE public.civic_ballot_forecast_snapshots
                    SET is_frozen=TRUE WHERE civic_ballot_id=%s""",
                            (ballot_ids[0],))
            self.assertEqual(rejected.exception.pgcode, "42501")
            cur.execute("ROLLBACK TO SAVEPOINT forbidden_freeze")
            cur.execute("RESET ROLE")
            cur.execute("""UPDATE public.civic_ballot_forecast_snapshots
                SET is_frozen=TRUE WHERE civic_ballot_id=%s""",
                        (ballot_ids[0],))
            cur.execute("SET LOCAL ROLE demos_staging_runtime")
            cur.execute("""UPDATE public.civic_ballot_forecast_snapshots
                  SET yes_count=8,no_count=1
                  WHERE civic_ballot_id=%s""", (ballot_ids[0],))
            self.assertEqual(cur.rowcount, 0, "Frozen rows must be immutable")
            cur.execute("ROLLBACK")

            cur.execute("SELECT count(*) FROM public.civic_ballot_forecast_snapshots")
            self.assertEqual(cur.fetchone(), (0,))
            cur.execute("SELECT count(*) FROM public.civic_ballots")
            self.assertEqual(cur.fetchone(), (0,))
            cur.execute("SELECT blocked FROM public.civic_push_delivery_guard WHERE id=1")
            self.assertEqual(cur.fetchone(), (True,))
            cur.execute("BEGIN")
            cur.execute("SET LOCAL civic.p5_runtime_approval='I_APPROVE_P5_SYNTHETIC_SNAPSHOT_ACL'")
            with self.assertRaisesRegex(psycopg2.Error, "P5_SNAPSHOT_ACL_ALREADY_USED_OR_CONFIGURED"):
                cur.execute(acl)
            cur.execute("ROLLBACK")


if __name__ == "__main__":
    unittest.main()
