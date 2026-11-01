"""Guard destructive civic migration tests against non-ephemeral databases.

This module performs *no* database access. The PostgreSQL integration fixture
runs DROP/CREATE statements, so it must never accept production/staging URLs.
"""
from urllib.parse import urlsplit


def require_ephemeral_civic_database_url(value: str) -> str:
    """Accept only the dedicated local CI PostgreSQL fixture endpoint."""
    if not isinstance(value, str) or not value:
        raise RuntimeError("CIVIC_TEST_DB_URL_REQUIRED")
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except (ValueError, TypeError):
        raise RuntimeError("REFUSE_NONLOCAL_DB") from None

    # An arbitrary URL containing 'localhost' is NOT necessarily local.
    # URI query parameters can override libpq host/service. Reject all.
    if (
        parsed.scheme not in {"postgres", "postgresql"}
        or parsed.hostname not in {"127.0.0.1", "::1", "localhost"}
        or port != 5432
        or parsed.username != "postgres"
        or parsed.path != "/civic_ci"
        or not parsed.password
        or parsed.query
        or parsed.fragment
    ):
        raise RuntimeError("REFUSE_NONLOCAL_DB")
    return value
