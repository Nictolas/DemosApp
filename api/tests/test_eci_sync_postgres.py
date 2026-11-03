"""Real two-connection ECI lock regression on ephemeral GitHub Actions PG16 only.

Requires the dedicated local civic_ci service. Never accepts production/staging
DATABASE_URL, and creates/drops only a uniquely named QA schema.
"""
import os
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from urllib.parse import urlsplit, urlunsplit, urlencode
from uuid import uuid4

from api.scripts import sync_eci
from api.tests.civic_test_database_safety import require_ephemeral_civic_database_url

try:
    import psycopg2
    from psycopg2 import sql
except ImportError:
    psycopg2 = None
    sql = None


@unittest.skipUnless(
    psycopg2 is not None and os.environ.get("CIVIC_TEST_DATABASE_URL"),
    "Ephemeral civic_ci PG16 is required; never access a real DEMOS database",
)
class EciTransactionalLockPostgresTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base_url = require_ephemeral_civic_database_url(
            os.environ["CIVIC_TEST_DATABASE_URL"]
        )
        if os.environ.get("DATABASE_URL") == cls.base_url:
            raise RuntimeError("REFUSE_SHARED_DATABASE_URL")
        cls.schema = "qa_eci_lock_" + uuid4().hex[:12]
        cls.identity = str(uuid4())
        parsed = urlsplit(cls.base_url)
        query = urlencode({
            "options": "-c search_path=" + cls.schema,
            "application_name": "demos_eci_lock_ci",
        })
        cls.dsn = urlunsplit((
            parsed.scheme, parsed.netloc, parsed.path, query, ""
        ))
        cls.admin = psycopg2.connect(cls.base_url)
        cls.admin.autocommit = True
        try:
            with cls.admin.cursor() as cur:
                cur.execute(
                    sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(cls.schema))
                )
            with psycopg2.connect(cls.dsn) as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        CREATE TABLE civic_runtime_identity (
                            id INTEGER PRIMARY KEY, db_identity UUID NOT NULL
                        );
                        CREATE TABLE civic_push_delivery_guard (
                            id INTEGER PRIMARY KEY, blocked BOOLEAN NOT NULL,
                            reason_code TEXT NOT NULL
                        );
                        CREATE TABLE eci (
                            id TEXT PRIMARY KEY, title TEXT NOT NULL,
                            signature_count BIGINT, slug TEXT, status TEXT,
                            end_date DATE, obiettivi TEXT, url TEXT
                        );
                        CREATE TABLE civic_new_initiative_notifications (
                            id BIGSERIAL PRIMARY KEY,
                            category TEXT NOT NULL, official_id TEXT NOT NULL,
                            title TEXT, target_path TEXT, status TEXT NOT NULL,
                            UNIQUE (category, official_id)
                        );
                    """)
                    cur.execute(
                        "INSERT INTO civic_runtime_identity VALUES (1, %s)",
                        (cls.identity,),
                    )
                    cur.execute(
                        "INSERT INTO civic_push_delivery_guard VALUES "
                        "(1, TRUE, 'ROLLOUT_NOT_APPROVED')"
                    )
                    cur.execute(
                        "INSERT INTO eci (id,title,status) "
                        "VALUES ('2026-000001','Historical record','ONGOING')"
                    )
        except Exception:
            cls.tearDownClass()
            raise

    @classmethod
    def tearDownClass(cls):
        admin = getattr(cls, "admin", None)
        if admin is not None:
            try:
                with admin.cursor() as cur:
                    cur.execute(
                        sql.SQL("DROP SCHEMA IF EXISTS {} CASCADE").format(
                            sql.Identifier(cls.schema)
                        )
                    )
            finally:
                admin.close()

    def test_simultaneous_eci_import_waits_and_deduplicates(self):
        rows = [
            ("2026-000001", "Historical record", 100,
             "eci-2026-000001", "ONGOING", None, None,
             "https://citizens-initiative.europa.eu/"),
            ("2026-000011", "New synthetic record", 1,
             "eci-2026-000011", "ONGOING", None, None,
             "https://citizens-initiative.europa.eu/"),
        ]

        holder = psycopg2.connect(self.dsn)
        try:
            # Hold the exact advisory lock from another real PG connection.
            with holder.cursor() as cur:
                cur.execute(
                    "SELECT pg_advisory_xact_lock("
                    "hashtextextended('demos:eci:replace_cache', 0))"
                )
            with patch.dict(os.environ, {
                "CIVIC_RUNTIME_DATABASE_ID": self.identity,
                "CIVIC_NEW_INITIATIVE_EVENTS_ENABLED": "true",
            }):
                with ThreadPoolExecutor(max_workers=1) as executor:
                    future = executor.submit(
                        sync_eci._replace_cache, self.dsn, rows
                    )
                    try:
                        # Prove the worker really waits at an advisory lock.
                        saw_waiting_lock = False
                        for _ in range(100):
                            with self.admin.cursor() as cur:
                                cur.execute("""
                                    SELECT EXISTS (
                                      SELECT 1 FROM pg_stat_activity
                                      WHERE datname = 'civic_ci'
                                        AND application_name = 'demos_eci_lock_ci'
                                        AND wait_event_type = 'Lock'
                                        AND wait_event = 'advisory'
                                    )
                                """)
                                saw_waiting_lock = bool(cur.fetchone()[0])
                            if saw_waiting_lock:
                                break
                            time.sleep(0.05)
                        self.assertTrue(
                            saw_waiting_lock,
                            "ECI sync must wait on the transaction advisory lock",
                        )
                        self.assertFalse(future.done())
                        with psycopg2.connect(self.dsn) as observer:
                            with observer.cursor() as cur:
                                cur.execute("SELECT id FROM eci ORDER BY id")
                                self.assertEqual(
                                    cur.fetchall(), [("2026-000001",)]
                                )
                                cur.execute(
                                    "SELECT count(*) FROM "
                                    "civic_new_initiative_notifications"
                                )
                                self.assertEqual(cur.fetchone(), (0,))
                    finally:
                        holder.commit()
                    future.result(timeout=15)

                # A real second sync sees the first result and never queues it.
                sync_eci._replace_cache(self.dsn, rows)

            with psycopg2.connect(self.dsn) as check:
                with check.cursor() as cur:
                    cur.execute("SELECT id FROM eci ORDER BY id")
                    self.assertEqual(
                        cur.fetchall(),
                        [("2026-000001",), ("2026-000011",)],
                    )
                    cur.execute("""
                        SELECT category, official_id, status
                        FROM civic_new_initiative_notifications
                    """)
                    self.assertEqual(
                        cur.fetchall(),
                        [("eci", "2026-000011", "suppressed")],
                    )
        finally:
            holder.rollback()
            holder.close()


if __name__ == "__main__":
    unittest.main()
