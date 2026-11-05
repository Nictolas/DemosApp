"""Real PostgreSQL role/DDL test, disposable CI database only.

Runs against CIVIC_TEST_DATABASE_URL from the isolated PG16/17 GitHub job.
Never accesses Supabase, Render, production, users or real FCM credentials.
"""
import os
import unittest
from unittest.mock import patch

import psycopg2

from api.scripts import sync_eci

SCHEMA = "eci_ci_no_delete"
IDENTITY = "00000000-0000-4000-8000-000000000539"
OLD_ID = "2026-000011"
NEW_ID = "2026-000012"


class EciNoDeleteRuntimePostgresTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        dsn = os.environ.get("CIVIC_TEST_DATABASE_URL")
        if not dsn or "127.0.0.1" not in dsn or "civic_ci" not in dsn:
            raise RuntimeError("CI_ECI_POSTGRES_EXPLICIT_LOOPBACK_TARGET_REQUIRED")
        cls.dsn = dsn
        # Keep the driver factory unbound when invoked from instance methods.
        cls.real_connect = staticmethod(psycopg2.connect)
        with cls.real_connect(cls.dsn) as con:
            with con.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM pg_roles WHERE rolname='demos_staging_runtime'"
                )
                if cur.fetchone() is None:
                    raise RuntimeError("CI_STAGING_RUNTIME_ROLE_NOT_SEEDED")
                cur.execute("CREATE SCHEMA eci_ci_no_delete")
                cur.execute("""
                    CREATE TABLE eci_ci_no_delete.eci (
                      id varchar PRIMARY KEY, title text NOT NULL,
                      signature_count integer, slug varchar,
                      status varchar, end_date date, obiettivi text,
                      url varchar, updated_at timestamptz
                    )
                """)
                cur.execute("""
                    CREATE TABLE eci_ci_no_delete.civic_runtime_identity (
                      id integer PRIMARY KEY, db_identity uuid NOT NULL
                    )
                """)
                cur.execute("""
                    CREATE TABLE eci_ci_no_delete.civic_push_delivery_guard (
                      id integer PRIMARY KEY, blocked boolean NOT NULL,
                      reason_code text
                    )
                """)
                cur.execute("""
                    CREATE TABLE eci_ci_no_delete.civic_new_initiative_notifications (
                      id bigserial PRIMARY KEY, category text NOT NULL,
                      official_id text NOT NULL, title text NOT NULL,
                      target_path text NOT NULL, status text NOT NULL,
                      UNIQUE(category, official_id)
                    )
                """)
                cur.execute("""
                    INSERT INTO eci_ci_no_delete.civic_runtime_identity
                      (id, db_identity) VALUES (1, %s)
                """, (IDENTITY,))
                cur.execute("""
                    INSERT INTO eci_ci_no_delete.civic_push_delivery_guard
                      (id, blocked, reason_code) VALUES (1, true, 'EMERGENCY_STOP')
                """)
                cur.execute("""
                    INSERT INTO eci_ci_no_delete.eci
                      (id, title, signature_count, status)
                    VALUES (%s, 'Historical ECI', 1, 'ONGOING')
                """, (OLD_ID,))
                cur.execute("""
                    INSERT INTO eci_ci_no_delete.civic_new_initiative_notifications
                      (category, official_id, title, target_path, status)
                    VALUES ('eci', %s, 'Historical ECI', '/eci', 'suppressed')
                """, (OLD_ID,))
                cur.execute(
                    "GRANT USAGE ON SCHEMA eci_ci_no_delete TO demos_staging_runtime"
                )
                for table in ("eci", "civic_push_delivery_guard",
                              "civic_new_initiative_notifications",
                              "civic_runtime_identity"):
                    cur.execute(
                        f"ALTER TABLE eci_ci_no_delete.{table} ENABLE ROW LEVEL SECURITY"
                    )
                    cur.execute(
                        f"CREATE POLICY eci_ci_runtime_read ON eci_ci_no_delete.{table} "
                        "FOR SELECT TO demos_staging_runtime USING (true)"
                    )
                for table in ("eci", "civic_new_initiative_notifications"):
                    cur.execute(
                        f"CREATE POLICY eci_ci_runtime_write ON eci_ci_no_delete.{table} "
                        "FOR ALL TO demos_staging_runtime USING (true) WITH CHECK (true)"
                    )
                cur.execute("""
                    CREATE POLICY eci_ci_guard_lock
                    ON eci_ci_no_delete.civic_push_delivery_guard
                    FOR ALL TO demos_staging_runtime
                    USING (true) WITH CHECK (true)
                """)
                cur.execute(
                    "GRANT SELECT, INSERT, UPDATE ON eci_ci_no_delete.eci "
                    "TO demos_staging_runtime"
                )
                cur.execute(
                    "GRANT SELECT ON eci_ci_no_delete.civic_runtime_identity "
                    "TO demos_staging_runtime"
                )
                cur.execute(
                    "GRANT SELECT, UPDATE ON eci_ci_no_delete.civic_push_delivery_guard "
                    "TO demos_staging_runtime"
                )
                cur.execute(
                    "GRANT SELECT, INSERT, UPDATE "
                    "ON eci_ci_no_delete.civic_new_initiative_notifications "
                    "TO demos_staging_runtime"
                )
                cur.execute(
                    "GRANT USAGE ON SEQUENCE eci_ci_no_delete."
                    "civic_new_initiative_notifications_id_seq "
                    "TO demos_staging_runtime"
                )

    @classmethod
    def tearDownClass(cls):
        with cls.real_connect(cls.dsn) as con:
            with con.cursor() as cur:
                cur.execute("DROP SCHEMA IF EXISTS eci_ci_no_delete CASCADE")

    def _runtime_connect(self, _url, connect_timeout=None):
        con = self.real_connect(self.dsn, connect_timeout=connect_timeout)
        con.autocommit = True
        with con.cursor() as cur:
            cur.execute("SET ROLE demos_staging_runtime")
            cur.execute("SET search_path TO eci_ci_no_delete,public")
        con.autocommit = False
        return con

    @staticmethod
    def _record(identifier, title, supporters):
        return (
            identifier, title, supporters, "eci-" + identifier, "ONGOING",
            "2027-08-25", "Official objective",
            "https://eci.ec.europa.eu/",
        )

    def test_repeatable_source_upsert_without_delete_grant(self):
        with self._runtime_connect(self.dsn) as con:
            with con.cursor() as cur:
                cur.execute(
                    "SELECT has_table_privilege(current_user, "
                    "'eci_ci_no_delete.eci', 'DELETE')"
                )
                self.assertFalse(cur.fetchone()[0])
                cur.execute("SELECT current_role")
                self.assertEqual(cur.fetchone()[0], "demos_staging_runtime")

        records = [
            self._record(OLD_ID, "Updated historical ECI", 111),
            self._record(NEW_ID, "Official new ECI", 222),
        ]
        with patch.dict(os.environ, {
            "CIVIC_RUNTIME_DATABASE_ID": IDENTITY,
            "CIVIC_NEW_INITIATIVE_EVENTS_ENABLED": "true",
        }), patch("psycopg2.connect", side_effect=self._runtime_connect):
            sync_eci._replace_cache(self.dsn, records)
            sync_eci._replace_cache(self.dsn, records)
            sync_eci._replace_cache(self.dsn, [records[1]])

        with self.real_connect(self.dsn) as con:
            with con.cursor() as cur:
                cur.execute("""
                  SELECT id, status, signature_count
                  FROM eci_ci_no_delete.eci ORDER BY id
                """)
                self.assertEqual(cur.fetchall(), [
                    (OLD_ID, "NOT_ONGOING", 111),
                    (NEW_ID, "ONGOING", 222),
                ])
                cur.execute("""
                  SELECT official_id,status
                  FROM eci_ci_no_delete.civic_new_initiative_notifications
                  ORDER BY official_id
                """)
                self.assertEqual(cur.fetchall(), [
                    (OLD_ID, "suppressed"),
                    (NEW_ID, "suppressed"),
                ])
                cur.execute("""
                  SELECT blocked FROM eci_ci_no_delete.civic_push_delivery_guard
                  WHERE id=1
                """)
                self.assertIs(cur.fetchone()[0], True)


if __name__ == "__main__":
    unittest.main()
