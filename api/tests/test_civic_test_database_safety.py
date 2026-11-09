"""Unit tests for the destructive-test database allowlist. No DB access."""
import unittest

from api.tests.civic_test_database_safety import require_ephemeral_civic_database_url


class EphemeralDatabaseSafetyTests(unittest.TestCase):
    def test_accepts_only_the_named_local_ci_fixture(self):
        for host in ("127.0.0.1", "localhost", "[::1]"):
            url = f"postgresql://postgres:civic_ci_only@{host}:5432/civic_ci"
            self.assertEqual(require_ephemeral_civic_database_url(url), url)

    def test_rejects_production_staging_and_tricky_hostnames(self):
        blocked = [
            "postgresql://postgres:pw@db.production.test:5432/civic_ci",
            "postgresql://localhost:pw@db.production.test:5432/civic_ci",
            "postgresql://postgres:pw@localhost.production.test:5432/civic_ci",
            "postgresql://postgres:pw@127.0.0.1:5432/prod",
            "postgresql://postgres:pw@127.0.0.1:5433/civic_ci",
            "postgresql://readonly:pw@127.0.0.1:5432/civic_ci",
            "postgresql://postgres:pw@127.0.0.1:5432/civic_ci?host=db.production.test",
            "postgresql://postgres:pw@127.0.0.1:5432/civic_ci?hostaddr=192.0.2.1",
            "postgresql://postgres:pw@127.0.0.1:5432/civic_ci?service=prod",
            "postgresql://postgres:pw@127.0.0.1:5432/civic_ci#staging",
            "https://postgres:pw@127.0.0.1:5432/civic_ci",
            "postgresql://postgres:pw@localhost:5432/other_civic_ci",
            "postgresql://postgres@localhost:5432/civic_ci",
            "postgresql://postgres:pw@localhost:notaport/civic_ci",
            "",
            None,
        ]
        for url in blocked:
            with self.subTest(url=bool(url)):
                with self.assertRaisesRegex(RuntimeError, "REFUSE_NONLOCAL_DB|CIVIC_TEST_DB_URL_REQUIRED"):
                    require_ephemeral_civic_database_url(url)


if __name__ == "__main__":
    unittest.main()
