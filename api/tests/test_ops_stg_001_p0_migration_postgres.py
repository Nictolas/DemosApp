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
        expected_major = int(os.environ.get("CIVIC_CI_POSTGRES_MAJOR", "0"))
        if cls.conn.server_version // 10000 != expected_major or expected_major not in (16, 17):
            cls.conn.close()
            raise RuntimeError("CIVIC_CI_POSTGRES_ENGINE_MISMATCH")
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

    def test_role_membership_bypasses_noinherit_and_preflight_must_reject(self):
        """PG16 proves NOINHERIT does not prohibit SET ROLE with a parent grant."""
        source = (ROOT / "api/scripts/unifiedStagingPreflight.js").read_text(
            encoding="utf-8")
        self.assertIn("pg_catalog.pg_auth_members", source)
        self.assertIn("m.member = r.oid", source)
        self.assertIn("AS has_role_memberships", source)
        member = "civic_ci_preflight_noinherit"
        parent = "civic_ci_unsafe_parent"
        with self.conn.cursor() as cur:
            cur.execute("CREATE ROLE civic_ci_preflight_noinherit NOINHERIT")
            cur.execute("CREATE ROLE civic_ci_unsafe_parent NOLOGIN")
            try:
                cur.execute(
                    "GRANT civic_ci_unsafe_parent TO civic_ci_preflight_noinherit")
                cur.execute("SELECT rolinherit FROM pg_catalog.pg_roles "
                            "WHERE rolname=%s", (member,))
                self.assertEqual(cur.fetchone(), (False,))
                cur.execute("SELECT pg_has_role(%s,%s,'SET')", (member, parent))
                self.assertEqual(cur.fetchone(), (True,),
                    "NOINHERIT does not prevent SET ROLE to granted parent")
                cur.execute("""SELECT EXISTS (
                    SELECT 1 FROM pg_catalog.pg_auth_members m
                    JOIN pg_catalog.pg_roles r ON r.oid=m.member
                    WHERE r.rolname=%s)""", (member,))
                self.assertEqual(cur.fetchone(), (True,),
                    "Preflight must detect role membership despite NOINHERIT")
                cur.execute("REVOKE civic_ci_unsafe_parent "
                            "FROM civic_ci_preflight_noinherit")
                cur.execute("""SELECT EXISTS (
                    SELECT 1 FROM pg_catalog.pg_auth_members m
                    JOIN pg_catalog.pg_roles r ON r.oid=m.member
                    WHERE r.rolname=%s)""", (member,))
                self.assertEqual(cur.fetchone(), (False,))
            finally:
                # The CI database/cluster is disposable; still remove roles.
                cur.execute("REVOKE civic_ci_unsafe_parent "
                            "FROM civic_ci_preflight_noinherit")
                cur.execute("DROP ROLE civic_ci_preflight_noinherit")
                cur.execute("DROP ROLE civic_ci_unsafe_parent")

    def test_preflight_detects_column_and_sequence_grants_not_visible_as_table_grants(self):
        """Disposable PG16: column UPDATE and sequence USAGE are real write capabilities."""
        source = (ROOT / "api/scripts/unifiedStagingPreflight.js").read_text(
            encoding="utf-8")
        self.assertIn("has_any_column_privilege(current_user", source)
        self.assertIn("has_sequence_privilege(current_user", source)
        self.assertIn("has_any_column_privilege('anon'", source)
        self.assertIn("has_any_column_privilege('authenticated'", source)
        role = "civic_ci_preflight_column_probe"
        table = "public.civic_ci_preflight_column_probe"
        sequence = "public.civic_ci_preflight_sequence_probe"
        with self.conn.cursor() as cur:
            cur.execute("CREATE ROLE civic_ci_preflight_column_probe NOLOGIN NOINHERIT")
            cur.execute("CREATE TABLE " + table + " (id integer PRIMARY KEY, value text)")
            cur.execute("CREATE SEQUENCE " + sequence)
            try:
                cur.execute("REVOKE ALL ON " + table + " FROM PUBLIC")
                cur.execute("REVOKE ALL ON " + sequence + " FROM PUBLIC")
                cur.execute("GRANT USAGE ON SCHEMA public TO " + role)
                cur.execute("GRANT UPDATE (value) ON " + table + " TO " + role)
                cur.execute("""SELECT has_table_privilege(%s,%s,'UPDATE'),
                            has_any_column_privilege(%s,%s,'UPDATE')""",
                            (role, table, role, table))
                self.assertEqual(cur.fetchone(), (False, True),
                    "Table-wide privilege check misses column-only UPDATE")
                cur.execute("GRANT USAGE ON SEQUENCE " + sequence + " TO " + role)
                cur.execute("""SELECT has_sequence_privilege(%s,%s,'USAGE,UPDATE')""",
                            (role, sequence))
                self.assertEqual(cur.fetchone(), (True,))
                # The preflight's combined table+sequence metadata audit must
                # find both forbidden capabilities without querying any rows.
                cur.execute("""SELECT c.relname,
                            (has_table_privilege(%s, c.oid,
                               'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
                             OR has_any_column_privilege(%s, c.oid,
                               'INSERT,UPDATE,REFERENCES')) AS can_write
                           FROM pg_catalog.pg_class c
                           WHERE c.oid=%s::regclass
                           UNION ALL
                           SELECT c.relname,
                                  has_sequence_privilege(%s,c.oid,'USAGE,UPDATE')
                           FROM pg_catalog.pg_class c
                           WHERE c.oid=%s::regclass""",
                           (role, role, table, role, sequence))
                self.assertEqual(set(cur.fetchall()), {
                    ("civic_ci_preflight_column_probe", True),
                    ("civic_ci_preflight_sequence_probe", True)
                })
                cur.execute("""SELECT has_table_privilege('anon',%s,'UPDATE'),
                            has_any_column_privilege('anon',%s,'UPDATE')""",
                            (table, table))
                self.assertEqual(cur.fetchone(), (False, False))
                cur.execute("GRANT UPDATE (value) ON " + table + " TO anon")
                cur.execute("""SELECT has_table_privilege('anon',%s,'UPDATE'),
                            has_any_column_privilege('anon',%s,'UPDATE')""",
                            (table, table))
                self.assertEqual(cur.fetchone(), (False, True),
                    "Public client column privilege must not bypass audit")
            finally:
                cur.execute("REVOKE ALL ON " + table + " FROM anon")
                cur.execute("DROP TABLE " + table)
                cur.execute("DROP SEQUENCE " + sequence)
                cur.execute("REVOKE USAGE ON SCHEMA public FROM " + role)
                cur.execute("DROP ROLE " + role)

    def test_staging_auth_provider_sequence_revoke_is_guarded(self):
        """Exact DCL on disposable PG16: approval, identity, revoke and repeat."""
        import hashlib
        path = (ROOT / "api/database/staging" /
                "ops_stg_001_revoke_public_auth_provider_sequence_20261103.sql")
        original = path.read_text(encoding="utf-8")
        real_hash = "0cbb6ace68a9f11956904e2a37898ec8"
        self.assertEqual(original.count(real_hash), 1)
        sql = original.replace(real_hash,
            hashlib.md5(SYNTHETIC_ID.encode("ascii")).hexdigest())
        sequence = "public.user_auth_providers_id_seq"
        with self.conn.cursor() as cur:
            cur.execute("""CREATE TABLE public.user_auth_providers (
                id SERIAL PRIMARY KEY, provider text NOT NULL)""")
            cur.execute("ALTER TABLE public.user_auth_providers ENABLE ROW LEVEL SECURITY")
            cur.execute("""REVOKE ALL ON public.user_auth_providers
                FROM PUBLIC, anon, authenticated""")
            cur.execute("GRANT ALL ON SEQUENCE " + sequence +
                        " TO anon,authenticated")
            try:
                with self.assertRaisesRegex(psycopg2.Error,
                        "STAGING_SEQUENCE_REVOKE_APPROVAL_REQUIRED"):
                    cur.execute(sql)
                cur.execute("ROLLBACK")
                cur.execute("SELECT has_sequence_privilege('anon',%s,'UPDATE')",
                            (sequence,))
                self.assertEqual(cur.fetchone(), (True,))
                cur.execute("UPDATE public.civic_runtime_identity SET db_identity=%s WHERE id=1",
                            (WRONG_ID,))
                cur.execute("BEGIN")
                cur.execute("""SET LOCAL civic.sequence_revoke_approval =
                    'I_APPROVE_STAGING_SEQUENCE_REVOKE'""")
                with self.assertRaisesRegex(psycopg2.Error,
                        "STAGING_SEQUENCE_REVOKE_WRONG_DATABASE"):
                    cur.execute(sql)
                cur.execute("ROLLBACK")
                cur.execute("UPDATE public.civic_runtime_identity SET db_identity=%s WHERE id=1",
                            (SYNTHETIC_ID,))
                cur.execute("BEGIN")
                cur.execute("""SET LOCAL civic.sequence_revoke_approval =
                    'I_APPROVE_STAGING_SEQUENCE_REVOKE'""")
                cur.execute(sql)
                cur.execute("COMMIT")
                for role in ("anon", "authenticated"):
                    cur.execute("""SELECT has_sequence_privilege(
                        %s,%s,'SELECT,USAGE,UPDATE')""", (role,sequence))
                    self.assertEqual(cur.fetchone(), (False,))
                cur.execute("BEGIN")
                cur.execute("""SET LOCAL civic.sequence_revoke_approval =
                    'I_APPROVE_STAGING_SEQUENCE_REVOKE'""")
                with self.assertRaisesRegex(psycopg2.Error,
                        "STAGING_SEQUENCE_REVOKE_UNEXPECTED_EXISTING_GRANTS"):
                    cur.execute(sql)
                cur.execute("ROLLBACK")
                cur.execute("SELECT blocked FROM public.civic_push_delivery_guard WHERE id=1")
                self.assertEqual(cur.fetchone(), (True,))
            finally:
                cur.execute("DROP TABLE public.user_auth_providers CASCADE")


    def test_y_four_pinned_qa_fixtures_fail_closed_on_changes(self):
        """Exercise the real 4-QA branch on disposable PG16/17; rollback everything."""
        path = ROOT / "api/database/staging/ops_stg_001_preflight_role_disabled_20261103.sql"
        source = path.read_text(encoding="utf-8")
        self.assertIn("ELSIF (SELECT count(*) FROM public.users) = 4 THEN", source)
        qa1 = USER_OUTSIDE
        qa2 = "44444444-4444-4444-8444-444444444444"
        stage_fps = ("837b804435eef9fafbc580ce17a24fd4",
                     "c1f6c8a73f029da2ee54a60dfd6a89d3")
        for fp in stage_fps:
            self.assertEqual(source.count(fp), 4)
        sql = source.replace(STAGING_HASH,
                             hashlib.md5(SYNTHETIC_ID.encode("ascii")).hexdigest())
        sql = sql.replace("current_database() <> 'postgres'",
                          "current_database() <> 'civic_ci'")
        for fp, uid in zip(stage_fps, (qa1, qa2)):
            sql = sql.replace(fp, hashlib.md5(uid.encode("ascii")).hexdigest())
        self.assertNotIn(stage_fps[0], sql)
        self.assertNotIn(stage_fps[1], sql)
        with self.conn.cursor() as cur:
            cur.execute("BEGIN")
            try:
                # Only CI transaction-scoped fixture changes. All disappear
                # on ROLLBACK and cannot affect the real staging.
                for name, kind in (
                    ("nome", "text"), ("ruolo", "text"),
                    ("account_type", "varchar(20)"),
                    ("political_opinions_consent", "boolean"),
                    ("political_opinions_consent_timestamp", "timestamptz"),
                    ("political_opinions_consent_ip_address", "text"),
                    ("political_opinions_consent_user_agent", "text"),
                    ("rappresentante_camera", "uuid"),
                    ("candidato_comune", "uuid"),
                    ("candidato_attivo", "boolean"),
                    ("energia_nucleare", "text"),
                ):
                    cur.execute("ALTER TABLE public.users ADD COLUMN " + name + " " + kind)
                cur.execute("CREATE SCHEMA auth")
                cur.execute("CREATE TABLE auth.users(id uuid PRIMARY KEY)")
                for table in ("user_devices", "user_consents", "opinioni_risposte"):
                    cur.execute("CREATE TABLE public." + table + "(user_id uuid)")
                cur.execute("""CREATE TABLE public.notifiche_preferenze (
                    user_id uuid, eci boolean, iniziative_popolari boolean,
                    referendum_abrogativi boolean
                )""")
                for uid in (qa1, qa2):
                    cur.execute("""INSERT INTO public.users (
                        id,status,nome,ruolo,account_type,political_opinions_consent,
                        candidato_attivo) VALUES
                        (%s,'a','Synthetic QA fixture','E','PERSON',FALSE,FALSE)""", (uid,))
                cur.execute("""INSERT INTO public.notifiche_preferenze
                    VALUES (%s,TRUE,TRUE,TRUE),(%s,FALSE,FALSE,FALSE)""", (qa1, qa2))
                cur.execute("UPDATE public.civic_runtime_identity SET db_identity=%s WHERE id=1",
                            (SYNTHETIC_ID,))
                for table in ("civic_runtime_identity","civic_push_delivery_guard"):
                    cur.execute("ALTER TABLE public." + table + " ENABLE ROW LEVEL SECURITY")
                # Exercise happy path, then remove role and policies by
                # rolling back to the test savepoint.
                cur.execute("""SET LOCAL civic.preflight_role_approval =
                    'I_APPROVE_DISABLED_PREFLIGHT_ROLE'""")
                cur.execute("SAVEPOINT qa_happy")
                cur.execute(sql)
                cur.execute("SELECT count(*) FROM pg_roles WHERE rolname='demos_staging_preflight'")
                self.assertEqual(cur.fetchone(), (1,))
                cur.execute("ROLLBACK TO SAVEPOINT qa_happy")

                def expect_closed(message, mutate):
                    cur.execute("SAVEPOINT qa_negative")
                    mutate()
                    cur.execute("SAVEPOINT qa_attempt")
                    with self.assertRaisesRegex(psycopg2.Error, message):
                        cur.execute(sql)
                    cur.execute("ROLLBACK TO SAVEPOINT qa_attempt")
                    cur.execute("ROLLBACK TO SAVEPOINT qa_negative")

                expect_closed("PREFLIGHT_ROLE_NON_SYNTHETIC_USERS",
                              lambda: cur.execute(
                                  "INSERT INTO public.users (id,status) VALUES (%s,'a')",
                                  ("55555555-5555-4555-8555-555555555555",)))
                expect_closed("PREFLIGHT_ROLE_NON_SYNTHETIC_USERS",
                              lambda: cur.execute(
                                  "UPDATE public.notifiche_preferenze SET eci=TRUE, iniziative_popolari=TRUE, referendum_abrogativi=TRUE WHERE user_id=%s",
                                  (qa2,)))
                expect_closed("PREFLIGHT_ROLE_NON_SYNTHETIC_USERS",
                              lambda: cur.execute(
                                  "INSERT INTO public.user_devices(user_id) VALUES (%s)",
                                  (qa1,)))
                expect_closed("PREFLIGHT_ROLE_NON_SYNTHETIC_USERS",
                              lambda: cur.execute(
                                  "UPDATE public.users SET status='pending' WHERE id=%s",
                                  (qa1,)))
            finally:
                cur.execute("ROLLBACK")
        # No roles, policies, extra users or test tables survive.
        with self.conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM pg_roles WHERE rolname='demos_staging_preflight'")
            self.assertEqual(cur.fetchone(), (0,))
            cur.execute("SELECT count(*) FROM public.users")
            self.assertEqual(cur.fetchone(), (2,))

    def test_z_disabled_preflight_role_is_strictly_read_only_and_requires_approval(self):
        """Real PG16/17 role/policies, but passwordless and only in disposable CI."""
        path = ROOT / "api/database/staging/ops_stg_001_preflight_role_disabled_20261103.sql"
        source = path.read_text(encoding="utf-8")
        self.assertEqual(source.count(STAGING_HASH), 1)
        # CI fixture is civic_ci, while the production migration requires
        # current_database()='postgres'. Alter only the in-memory CI copy;
        # the guarded repository SQL must always retain the real DB name.
        self.assertEqual(source.count("current_database() <> 'postgres'"), 1)
        sql = source.replace(STAGING_HASH,
                             hashlib.md5(SYNTHETIC_ID.encode("ascii")).hexdigest())
        sql = sql.replace("current_database() <> 'postgres'",
                          "current_database() <> 'civic_ci'")
        role = "demos_staging_preflight"
        with self.conn.cursor() as cur:
            # Real provider already has RLS; the disposable P0 fixture
            # needs to enable it before exercising the exact guarded SQL.
            for table in ("civic_runtime_identity", "civic_push_delivery_guard"):
                cur.execute("ALTER TABLE public." + table + " ENABLE ROW LEVEL SECURITY")
            with self.assertRaisesRegex(psycopg2.Error,
                    "PREFLIGHT_ROLE_OPERATOR_APPROVAL_REQUIRED"):
                cur.execute(sql)
            cur.execute("ROLLBACK")
            cur.execute("SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname=%s", (role,))
            self.assertEqual(cur.fetchone(), (0,), "No role before explicit approval")

            cur.execute("UPDATE public.civic_runtime_identity SET db_identity=%s WHERE id=1",
                        (WRONG_ID,))
            cur.execute("BEGIN")
            cur.execute("""SET LOCAL civic.preflight_role_approval =
                'I_APPROVE_DISABLED_PREFLIGHT_ROLE'""")
            with self.assertRaisesRegex(psycopg2.Error,
                    "PREFLIGHT_ROLE_WRONG_DATABASE"):
                cur.execute(sql)
            cur.execute("ROLLBACK")
            cur.execute("UPDATE public.civic_runtime_identity SET db_identity=%s WHERE id=1",
                        (SYNTHETIC_ID,))

            cur.execute("UPDATE public.civic_push_delivery_guard SET blocked=FALSE WHERE id=1")
            cur.execute("BEGIN")
            cur.execute("""SET LOCAL civic.preflight_role_approval =
                'I_APPROVE_DISABLED_PREFLIGHT_ROLE'""")
            with self.assertRaisesRegex(psycopg2.Error,
                    "PREFLIGHT_ROLE_PUSH_MUST_REMAIN_BLOCKED"):
                cur.execute(sql)
            cur.execute("ROLLBACK")
            cur.execute("UPDATE public.civic_push_delivery_guard SET blocked=TRUE WHERE id=1")

            cur.execute("BEGIN")
            cur.execute("""SET LOCAL civic.preflight_role_approval =
                'I_APPROVE_DISABLED_PREFLIGHT_ROLE'""")
            cur.execute(sql)
            cur.execute("COMMIT")

            cur.execute("""SELECT rolcanlogin,rolinherit,rolsuper,rolbypassrls,
                           rolcreatedb,rolcreaterole,rolreplication,rolconnlimit
                           FROM pg_catalog.pg_roles WHERE rolname=%s""", (role,))
            self.assertEqual(cur.fetchone(),
                             (True,False,False,False,False,False,False,1))
            cur.execute("SELECT rolpassword FROM pg_catalog.pg_authid WHERE rolname=%s",
                        (role,))
            self.assertEqual(cur.fetchone(), (None,),
                             "Role must have no usable password or secret")
            cur.execute("""SELECT setconfig FROM pg_catalog.pg_db_role_setting s
                           JOIN pg_catalog.pg_roles r ON r.oid=s.setrole
                           WHERE r.rolname=%s AND s.setdatabase=0""", (role,))
            defaults = cur.fetchone()[0]
            self.assertIn("default_transaction_read_only=on", defaults)
            self.assertTrue(any(x.startswith("statement_timeout=") for x in defaults))
            for table, allowed in (
                ("civic_runtime_identity",("id","db_identity")),
                ("civic_push_delivery_guard",("id","blocked"))
            ):
                cur.execute("""SELECT has_table_privilege(%s,%s,'SELECT'),
                    has_any_column_privilege(%s,%s,'INSERT,UPDATE,REFERENCES')""",
                    (role,"public."+table,role,"public."+table))
                self.assertEqual(cur.fetchone(),(False,False))
                for column in allowed:
                    cur.execute("""SELECT has_column_privilege(%s,%s,%s,'SELECT')""",
                                (role,"public."+table,column))
                    self.assertEqual(cur.fetchone(),(True,))
            cur.execute("""SELECT count(*) FROM pg_catalog.pg_auth_members m
                JOIN pg_catalog.pg_roles r ON r.oid=m.member
                WHERE r.rolname=%s""", (role,))
            self.assertEqual(cur.fetchone(), (0,))

            # SET LOCAL ROLE tests the real permission/RLS boundary.
            cur.execute("BEGIN")
            cur.execute("SET LOCAL ROLE demos_staging_preflight")
            cur.execute("""SELECT md5(db_identity::text) FROM public.civic_runtime_identity
                           WHERE id=1""")
            self.assertEqual(cur.fetchone(),
                             (hashlib.md5(SYNTHETIC_ID.encode("ascii")).hexdigest(),))
            cur.execute("SELECT blocked FROM public.civic_push_delivery_guard WHERE id=1")
            self.assertEqual(cur.fetchone(), (True,))
            cur.execute("SAVEPOINT forbidden_users")
            with self.assertRaises(psycopg2.Error) as rejected:
                cur.execute("SELECT count(*) FROM public.users")
            self.assertEqual(rejected.exception.pgcode, "42501")
            cur.execute("ROLLBACK TO SAVEPOINT forbidden_users")
            cur.execute("SAVEPOINT forbidden_guard_update")
            with self.assertRaises(psycopg2.Error) as rejected:
                cur.execute("UPDATE public.civic_push_delivery_guard SET blocked=FALSE")
            self.assertEqual(rejected.exception.pgcode, "42501")
            cur.execute("ROLLBACK TO SAVEPOINT forbidden_guard_update")
            cur.execute("ROLLBACK")

            cur.execute("BEGIN")
            cur.execute("""SET LOCAL civic.preflight_role_approval =
                'I_APPROVE_DISABLED_PREFLIGHT_ROLE'""")
            with self.assertRaisesRegex(psycopg2.Error,
                    "PREFLIGHT_ROLE_ALREADY_EXISTS"):
                cur.execute(sql)
            cur.execute("ROLLBACK")
            cur.execute("SELECT blocked FROM public.civic_push_delivery_guard WHERE id=1")
            self.assertEqual(cur.fetchone(), (True,))
            cur.execute("SELECT count(*) FROM public.users")
            self.assertEqual(cur.fetchone(), (2,))



if __name__ == "__main__":
    unittest.main()
