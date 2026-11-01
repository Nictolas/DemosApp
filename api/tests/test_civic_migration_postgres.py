"""Integration contract for new civic notifications against an EPHEMERAL PostgreSQL.

Run only with CIVIC_TEST_DATABASE_URL (GitHub Actions service container).
Never fall back to DATABASE_URL or use any real DEMOS project/database.
"""
import os
from pathlib import Path
import re
import unittest
from uuid import uuid4

try:
    import psycopg2
except ImportError:
    psycopg2 = None

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "api/database/20261101_civic_new_initiative_notifications.sql"
COLLECTOR = ROOT / "api/services/civicNewInitiativeEventCollector.js"

@unittest.skipUnless(
    psycopg2 is not None and os.environ.get("CIVIC_TEST_DATABASE_URL"),
    "Ephemeral PostgreSQL required; real database URLs must NEVER be used"
)
class MigrationContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        url = os.environ["CIVIC_TEST_DATABASE_URL"]
        if not ("127.0.0.1" in url or "localhost" in url):
            raise RuntimeError("REFUSE_NONLOCAL_DB")
        cls.conn = psycopg2.connect(url)
        cls.conn.autocommit = True

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def setUp(self):
        with self.conn.cursor() as cur:
            cur.execute("DROP TABLE IF EXISTS civic_new_initiative_notifications")
            cur.execute("DROP TABLE IF EXISTS iniziative_ministero")
            cur.execute("DROP TABLE IF EXISTS eci")
            cur.execute("DROP TABLE IF EXISTS notifiche_preferenze")
            cur.execute("""
                CREATE TABLE notifiche_preferenze (
                    user_id UUID PRIMARY KEY
                );
                CREATE TABLE iniziative_ministero (
                    id_ministero VARCHAR(100), titolo TEXT NOT NULL,
                    tipo VARCHAR(100), stato VARCHAR(40), data_fine DATE
                );
                CREATE TABLE eci (
                    id VARCHAR(100) PRIMARY KEY, title TEXT NOT NULL,
                    status VARCHAR(40)
                );
            """)
            cur.execute("""
                INSERT INTO iniziative_ministero (id_ministero,titolo,tipo,stato,data_fine)
                VALUES
                ('111','Proposta storica','Iniziativa popolare','in_corso',CURRENT_DATE + 30),
                ('222','Referendum storico','Referendum abrogativo','in_corso',CURRENT_DATE + 30)
            """)
            cur.execute("""
                INSERT INTO eci (id,title,status) VALUES
                ('2026-000001', 'ECI storica', 'ONGOING')
            """)

    def apply_migration(self):
        with self.conn.cursor() as cur:
            cur.execute(MIGRATION.read_text(encoding="utf8"))

    def query(self, sql, params=None):
        with self.conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall() if cur.description else []

    def test_migration_baseline_opt_out_unique_rls(self):
        self.apply_migration()
        user = str(uuid4())
        self.query("INSERT INTO notifiche_preferenze(user_id) VALUES (%s)", (user,))
        flags = self.query("""
            SELECT iniziative_popolari, referendum_abrogativi, eci
            FROM notifiche_preferenze WHERE user_id = %s
        """, (user,))
        self.assertEqual(flags, [(False, False, False)])
        baseline = self.query("""
            SELECT category, official_id, status
            FROM civic_new_initiative_notifications ORDER BY category
        """)
        self.assertEqual(len(baseline), 3)
        self.assertEqual({r[2] for r in baseline}, {"suppressed"})
        self.assertEqual(
            {r[0] for r in baseline},
            {"iniziative_popolari", "referendum_abrogativi", "eci"},
        )

        self.assertEqual(self.query("""
            SELECT relrowsecurity
            FROM pg_class
            WHERE oid = 'civic_new_initiative_notifications'::regclass
        """), [(True,)])
        self.assertEqual(self.query("""
            SELECT blocked, reason_code
            FROM civic_push_delivery_guard WHERE id = 1
        """), [(True, "ROLLOUT_NOT_APPROVED")])
        self.assertEqual(self.query("""
            SELECT relrowsecurity FROM pg_class
            WHERE oid = 'civic_push_delivery_guard'::regclass
        """), [(True,)])
        # PUBLIC is a PostgreSQL pseudo-role, not a named role for
        # has_table_privilege(). Inspect ACL grants for grantee OID 0 instead.
        self.assertEqual(self.query("""
            SELECT EXISTS (
              SELECT 1 FROM pg_class c,
                LATERAL aclexplode(COALESCE(
                  c.relacl, acldefault('r', c.relowner))) acl
              WHERE c.oid = 'civic_new_initiative_notifications'::regclass
                AND acl.grantee = 0
                AND acl.privilege_type = 'SELECT'
            )
        """), [(False,)])

        # Re-run verifies idempotency and no historical event is re-created.
        self.apply_migration()
        self.assertEqual(self.query("""
            SELECT COUNT(*), COUNT(*) FILTER (WHERE status='pending')
            FROM civic_new_initiative_notifications
        """), [(3, 0)])
        self.assertEqual(self.query("""
            SELECT blocked FROM civic_push_delivery_guard WHERE id = 1
        """), [(True,)])

    def test_collector_creates_only_new_official_ids_once(self):
        self.apply_migration()
        with self.conn.cursor() as cur:
            cur.execute("""
                INSERT INTO iniziative_ministero (id_ministero,titolo,tipo,stato,data_fine)
                VALUES
                ('333','Nuova iniziativa','Iniziativa popolare','in_corso',CURRENT_DATE + 30),
                ('444','Nuovo referendum','Referendum abrogativo','in_corso',CURRENT_DATE + 30),
                ('555','Referendum scaduto','Referendum abrogativo','conclusa',CURRENT_DATE - 5)
            """)
        code = COLLECTOR.read_text(encoding="utf8")
        actual_sql = re.search(
            r"const result = await pool\.query\(`([\s\S]*?)`\);", code
        )
        self.assertIsNotNone(actual_sql)
        first = self.query(actual_sql.group(1))
        self.assertEqual(len(first), 2)
        self.assertEqual(len(self.query(actual_sql.group(1))), 0)

        statuses = self.query("""
            SELECT official_id,status FROM civic_new_initiative_notifications
            WHERE category != 'eci'
            ORDER BY official_id
        """)
        self.assertEqual(statuses, [
            ("111", "suppressed"), ("222", "suppressed"),
            ("333", "pending"), ("444", "pending")
        ])
        # Updating a title / signatures does not change the official ID.
        self.query("""
            UPDATE iniziative_ministero SET titolo = 'Titolo cambiato'
            WHERE id_ministero = '333'
        """)
        self.assertEqual(self.query(actual_sql.group(1)), [])

    def test_no_public_read_even_when_role_has_table_select(self):
        self.apply_migration()
        # RLS default-deny if grants are accidentally added in a future release.
        with self.conn.cursor() as cur:
            cur.execute("DROP ROLE IF EXISTS civic_untrusted_reader")
            cur.execute("CREATE ROLE civic_untrusted_reader")
            cur.execute(
                "GRANT USAGE ON SCHEMA public TO civic_untrusted_reader"
            )
            cur.execute("""
                GRANT SELECT ON civic_new_initiative_notifications
                TO civic_untrusted_reader
            """)
            try:
                cur.execute("SET ROLE civic_untrusted_reader")
                cur.execute(
                    "SELECT count(*) FROM civic_new_initiative_notifications"
                )
                count = cur.fetchone()[0]
            finally:
                cur.execute("RESET ROLE")
                cur.execute("REVOKE SELECT ON civic_new_initiative_notifications FROM civic_untrusted_reader")
                cur.execute("REVOKE USAGE ON SCHEMA public FROM civic_untrusted_reader")
                cur.execute("DROP ROLE civic_untrusted_reader")
        self.assertEqual(count, 0)


if __name__ == "__main__":
    unittest.main()
