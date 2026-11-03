import unittest
from unittest.mock import patch, Mock

from api.scripts import sync_eci


class FakeResponse:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self):
        return self._payload


class FakeSession:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def request(self, method, url, headers=None, json=None, timeout=None):
        self.calls.append({
            "method": method,
            "url": url,
            "headers": headers,
            "json": json,
            "timeout": timeout,
        })
        if not self.responses:
            raise AssertionError("Unexpected HTTP request")
        return FakeResponse(self.responses.pop(0))


class SyncEciUnitTests(unittest.TestCase):
    def test_strip_html_and_date_normalization(self):
        self.assertEqual(
            sync_eci._strip_html("<p>Uno <strong>due</strong> &amp; tre</p>"),
            "Uno due & tre",
        )
        self.assertEqual(sync_eci._parse_eu_date("25/08/2027"), "2027-08-25")
        self.assertIsNone(sync_eci._parse_eu_date("31/02/2027"))
        self.assertIsNone(sync_eci._parse_eu_date("2027-08-25"))

    def test_ongoing_feed_is_paginated_and_validated(self):
        session = FakeSession([
            {
                "recordsFound": 3,
                "entries": [
                    {"id": 1, "status": "ONGOING"},
                    {"id": 2, "status": "ONGOING"},
                ],
            },
            {
                "recordsFound": 3,
                "entries": [{"id": 3, "status": "ONGOING"}],
            },
        ])
        entries = sync_eci._fetch_ongoing_entries(session=session)
        self.assertEqual([item["id"] for item in entries], [1, 2, 3])
        self.assertEqual(len(session.calls), 2)
        self.assertIn("/search/ONGOING/IT/0/", session.calls[0]["url"])
        self.assertIn("/search/ONGOING/IT/2/", session.calls[1]["url"])
        self.assertEqual(session.calls[0]["method"], "POST")
        self.assertEqual(session.calls[0]["json"], {})

    def test_feed_rejects_empty_mixed_or_incomplete_results(self):
        with self.assertRaisesRegex(RuntimeError, "nessuna iniziativa ONGOING"):
            sync_eci._fetch_ongoing_entries(session=FakeSession([
                {"recordsFound": 0, "entries": []},
            ]))

        with self.assertRaisesRegex(RuntimeError, "status inatteso"):
            sync_eci._fetch_ongoing_entries(session=FakeSession([
                {"recordsFound": 1, "entries": [{"id": 1, "status": "REGISTERED"}]},
            ]))

        with self.assertRaisesRegex(RuntimeError, "incompleta"):
            sync_eci._fetch_ongoing_entries(session=FakeSession([
                {"recordsFound": 2, "entries": [{"id": 1, "status": "ONGOING"}]},
                {"recordsFound": 2, "entries": []},
            ]))

    def test_record_uses_italian_detail_and_direct_official_signing_link(self):
        entry = {
            "id": 9173,
            "year": "2026",
            "number": "000011",
            "pubRegNum": "ECI(2026)000011",
            "status": "ONGOING",
            "title": "Fallback title",
            "totalSupporters": 56413,
            "supportLink": "https://eci.ec.europa.eu/066/public/?lg=it",
        }
        detail = {
            "status": "ONGOING",
            "deadline": "25/08/2027",
            "linguisticVersions": [
                {
                    "original": True,
                    "languageCode": "EN",
                    "title": "English title",
                    "objectives": "<p>English objectives</p>",
                    "supportLink": "https://eci.ec.europa.eu/066/public/?lg=en",
                },
                {
                    "original": False,
                    "languageCode": "IT",
                    "title": "Titolo italiano",
                    "objectives": "<p>Obiettivo <strong>ufficiale</strong></p>",
                    "supportLink": "https://eci.ec.europa.eu/066/public/?lg=it",
                },
            ],
        }
        record = sync_eci._normalize_record(entry, detail)
        self.assertEqual(record[0], "2026-000011")
        self.assertEqual(record[1], "Titolo italiano")
        self.assertEqual(record[2], 56413)
        self.assertEqual(record[3], "eci-2026-000011")
        self.assertEqual(record[4], "ONGOING")
        self.assertEqual(record[5], "2027-08-25")
        self.assertEqual(record[6], "Obiettivo ufficiale")
        self.assertEqual(record[7], "https://eci.ec.europa.eu/066/public/?lg=it")

    def test_record_rejects_non_ongoing_detail_or_invalid_identity(self):
        entry = {
            "year": "2026",
            "number": "000011",
            "totalSupporters": 1,
        }
        with self.assertRaisesRegex(RuntimeError, "non ONGOING"):
            sync_eci._normalize_record(entry, {"status": "REGISTERED", "linguisticVersions": []})
        with self.assertRaisesRegex(RuntimeError, "Identificatore ECI ufficiale non valido"):
            sync_eci._normalize_identity({"pubRegNum": "bad"})

    def test_dry_run_never_calls_database_replace(self):
        fake_records = [
            ("2026-000011", "Titolo", 1, "eci-2026-000011", "ONGOING", None, None, "https://example.test"),
        ]
        with patch.object(sync_eci, "fetch_official_records", return_value=fake_records), patch.object(
            sync_eci, "_replace_cache"
        ) as replace_cache:
            count = sync_eci.sync(dry_run=True)
        self.assertEqual(count, 1)
        replace_cache.assert_not_called()

    def test_civic_identity_matches_before_sync_and_rejects_missing_or_wrong_db(self):
        expected = "00000000-0000-4000-8000-000000000539"
        cursor = Mock()
        cursor.fetchall.return_value = [(expected,)]
        sync_eci._verify_civic_database_identity(cursor, expected)
        cursor.execute.assert_called_once()
        self.assertIn("civic_runtime_identity", cursor.execute.call_args.args[0])

        for invalid in (None, "", "INVALID", "postgresql://password"):
            cursor.reset_mock()
            with self.assertRaisesRegex(RuntimeError, "NOT_CONFIGURED"):
                sync_eci._verify_civic_database_identity(cursor, invalid)
            cursor.execute.assert_not_called()

        cursor.fetchall.return_value = [("00000000-0000-4000-8000-000000000540",)]
        with self.assertRaisesRegex(RuntimeError, "IDENTITY_MISMATCH"):
            sync_eci._verify_civic_database_identity(cursor, expected)

        cursor.fetchall.return_value = []
        with self.assertRaisesRegex(RuntimeError, "IDENTITY_MISMATCH"):
            sync_eci._verify_civic_database_identity(cursor, expected)

        cursor.execute.side_effect = RuntimeError("database password SECRET")
        with self.assertRaisesRegex(RuntimeError, "^CIVIC_DATABASE_IDENTITY_UNAVAILABLE$"):
            sync_eci._verify_civic_database_identity(cursor, expected)

    def test_cache_replacement_rejects_missing_identity_without_any_write(self):
        # No real database is used. A mocked connection proves that even when
        # civic notifications are OFF, the ECI cache cannot be deleted.
        from types import ModuleType
        from unittest.mock import MagicMock
        import os
        import sys

        conn = MagicMock()
        cur = MagicMock()
        conn.__enter__.return_value = conn
        conn.cursor.return_value.__enter__.return_value = cur

        fake_pg = ModuleType("psycopg2")
        fake_pg.connect = Mock(return_value=conn)
        fake_extras = ModuleType("psycopg2.extras")
        fake_extras.execute_values = Mock()
        records = [
            ("2026-000011", "Test", 0, "eci-2026-000011", "ONGOING",
             None, None, "https://example.test")
        ]
        for flag in ("false", "true"):
            cur.reset_mock()
            with patch.dict(sys.modules, {
                "psycopg2": fake_pg,
                "psycopg2.extras": fake_extras,
            }), patch.dict(os.environ, {
                "CIVIC_NEW_INITIATIVE_EVENTS_ENABLED": flag,
                "CIVIC_RUNTIME_DATABASE_ID": "",
            }):
                with self.assertRaisesRegex(RuntimeError, "CIVIC_DATABASE_IDENTITY_NOT_CONFIGURED"):
                    sync_eci._replace_cache("postgresql://fixture/eci", records)
            cur.execute.assert_not_called()
        self.assertEqual(fake_extras.execute_values.call_count, 0)
        self.assertEqual(conn.close.call_count, 2)

    def test_cache_replacement_rejects_wrong_identity_before_delete(self):
        from types import ModuleType
        from unittest.mock import MagicMock
        import os
        import sys

        conn = MagicMock()
        cur = MagicMock()
        conn.__enter__.return_value = conn
        conn.cursor.return_value.__enter__.return_value = cur
        cur.fetchall.return_value = [("00000000-0000-4000-8000-000000000540",)]
        fake_pg = ModuleType("psycopg2")
        fake_pg.connect = Mock(return_value=conn)
        fake_extras = ModuleType("psycopg2.extras")
        fake_extras.execute_values = Mock()
        with patch.dict(sys.modules, {
            "psycopg2": fake_pg,
            "psycopg2.extras": fake_extras,
        }), patch.dict(os.environ, {
            "CIVIC_NEW_INITIATIVE_EVENTS_ENABLED": "false",
            "CIVIC_RUNTIME_DATABASE_ID": "00000000-0000-4000-8000-000000000539",
        }):
            with self.assertRaisesRegex(RuntimeError, "CIVIC_DATABASE_IDENTITY_MISMATCH"):
                sync_eci._replace_cache("postgresql://fixture/eci", [
                    ("2026-000011", "Test", 0, "eci-2026-000011", "ONGOING",
                     None, None, "https://example.test")
                ])
        self.assertEqual(cur.execute.call_count, 1)
        self.assertIn("civic_runtime_identity", cur.execute.call_args.args[0])
        fake_extras.execute_values.assert_not_called()
        conn.close.assert_called_once()

    def test_blocked_first_eci_import_suppresses_historical_events(self):
        """First recovery of a previously empty ECI cache must not push old IDs."""
        import os
        import sys
        from types import ModuleType
        from unittest.mock import MagicMock

        expected = "00000000-0000-4000-8000-000000000539"
        records = [(
            "2026-000011", "Synthetic existing initiative", 12,
            "eci-2026-000011", "ONGOING", "2027-08-25", None,
            "https://eci.ec.europa.eu/066/public/",
        )]
        conn = MagicMock()
        cur = MagicMock()
        conn.cursor.return_value.__enter__.return_value = cur
        # Verify identity, then see an empty cache on initial recovery.
        cur.fetchall.side_effect = [[(expected,)], []]
        # Cache has 1 record; the global delivery guard is blocked.
        cur.fetchone.side_effect = [(1,), (True, "ROLLOUT_NOT_APPROVED")]
        fake_pg = ModuleType("psycopg2")
        fake_pg.connect = Mock(return_value=conn)
        fake_extras = ModuleType("psycopg2.extras")
        fake_extras.execute_values = Mock()
        with patch.dict(sys.modules, {
            "psycopg2": fake_pg,
            "psycopg2.extras": fake_extras,
        }), patch.dict(os.environ, {
            "CIVIC_NEW_INITIATIVE_EVENTS_ENABLED": "true",
            "CIVIC_RUNTIME_DATABASE_ID": expected,
        }):
            sync_eci._replace_cache("postgresql://fixture/eci", records)

        self.assertEqual(fake_extras.execute_values.call_count, 2)
        cache_call, event_call = fake_extras.execute_values.call_args_list
        self.assertIn("INSERT INTO eci", cache_call.args[1])
        self.assertIn("INSERT INTO civic_new_initiative_notifications", event_call.args[1])
        self.assertIn("ON CONFLICT (category, official_id) DO NOTHING", event_call.args[1])
        self.assertEqual(
            event_call.args[2], [
                ("eci", "2026-000011", "Synthetic existing initiative",
                 "/eci", "suppressed")
            ]
        )
        conn.close.assert_called_once()

    def test_existing_eci_never_requeued_after_guard_unblocked(self):
        """Refreshing an unchanged official ID is not a second notification."""
        import os
        import sys
        from types import ModuleType
        from unittest.mock import MagicMock

        expected = "00000000-0000-4000-8000-000000000539"
        records = [(
            "2026-000011", "Updated title", 100,
            "eci-2026-000011", "ONGOING", "2027-08-25", None,
            "https://eci.ec.europa.eu/066/public/",
        )]
        conn = MagicMock()
        cur = MagicMock()
        conn.cursor.return_value.__enter__.return_value = cur
        cur.fetchall.side_effect = [[(expected,)], [("2026-000011",)]]
        cur.fetchone.side_effect = [(1,), (False, "ROLLOUT_APPROVED")]
        fake_pg = ModuleType("psycopg2")
        fake_pg.connect = Mock(return_value=conn)
        fake_extras = ModuleType("psycopg2.extras")
        fake_extras.execute_values = Mock()
        with patch.dict(sys.modules, {
            "psycopg2": fake_pg,
            "psycopg2.extras": fake_extras,
        }), patch.dict(os.environ, {
            "CIVIC_NEW_INITIATIVE_EVENTS_ENABLED": "true",
            "CIVIC_RUNTIME_DATABASE_ID": expected,
        }):
            sync_eci._replace_cache("postgresql://fixture/eci", records)

        # The cache is refreshed, but there is no second outbox INSERT.
        fake_extras.execute_values.assert_called_once()
        self.assertIn("INSERT INTO eci", fake_extras.execute_values.call_args.args[1])
        self.assertNotIn("civic_new_initiative_notifications",
            fake_extras.execute_values.call_args.args[1])
        conn.close.assert_called_once()

    def test_main_returns_nonzero_on_sync_failure(self):
        with patch.object(sync_eci, "sync", side_effect=RuntimeError("boom")):
            self.assertEqual(sync_eci.main(["--dry-run"]), 1)


if __name__ == "__main__":
    unittest.main()
