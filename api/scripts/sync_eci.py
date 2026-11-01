"""Sincronizza la cache DEMOS delle ICE attualmente in raccolta.

La sorgente e' l'API pubblica usata dal portale ufficiale dell'Iniziativa dei
cittadini europei. Il job non crea classifiche DEMOS e non inferisce stati dal
numero di firme: importa esclusivamente record con status ufficiale ONGOING.

Per una verifica non distruttiva della sorgente:
    python api/scripts/sync_eci.py --dry-run
"""

import argparse
import html as html_lib
import os
import re
import sys
from datetime import datetime
from html.parser import HTMLParser
from typing import Any, List, Optional, Sequence, Tuple

REGISTER_API = "https://register.eci.ec.europa.eu/core/api/register"
PORTAL_BASE = "https://citizens-initiative.europa.eu"
LANGUAGE = "IT"
STATUS = "ONGOING"
PAGE_SIZE = 10
REQUEST_TIMEOUT_SECONDS = 25
MAX_OBJECTIVES_LENGTH = 8000

HEADERS = {
    "Accept": "application/json",
    "User-Agent": "DEMOS-ECI-Sync/1.0 (+official EU public register)",
}


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: List[str] = []

    def handle_data(self, data: str) -> None:
        if data:
            self.parts.append(data)


def _strip_html(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    parser = _TextExtractor()
    parser.feed(value)
    parser.close()
    text = html_lib.unescape(" ".join(parser.parts))
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return None
    return text[:MAX_OBJECTIVES_LENGTH]


def _parse_eu_date(value: Optional[str]) -> Optional[str]:
    """Converte DD/MM/YYYY in YYYY-MM-DD e rifiuta date impossibili."""
    if not value:
        return None
    try:
        parsed = datetime.strptime(str(value).strip(), "%d/%m/%Y")
    except ValueError:
        return None
    return parsed.date().isoformat()


def _request_json(method: str, url: str, *, payload: Optional[dict] = None, session=None) -> dict:
    if session is None:
        try:
            import requests
        except ImportError as exc:  # pragma: no cover - dependency error is integration-only
            raise RuntimeError("Dipendenza requests mancante") from exc
        client = requests
    else:
        client = session
    response = client.request(
        method,
        url,
        headers=HEADERS,
        json=payload,
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, dict):
        raise RuntimeError(f"Risposta JSON inattesa da {url}")
    return data


def _fetch_ongoing_entries(*, session=None) -> List[dict]:
    """Legge tutte le ICE ONGOING dall'API ufficiale usando offset + limit."""
    entries: List[dict] = []
    seen_ids = set()
    offset = 0
    expected_total: Optional[int] = None

    while True:
        url = f"{REGISTER_API}/search/{STATUS}/{LANGUAGE}/{offset}/{PAGE_SIZE}"
        payload = _request_json("POST", url, payload={}, session=session)
        batch = payload.get("entries")
        if not isinstance(batch, list):
            raise RuntimeError("API ECI: campo entries mancante o non valido")

        records_found = payload.get("recordsFound")
        if expected_total is None:
            try:
                expected_total = int(records_found)
            except (TypeError, ValueError) as exc:
                raise RuntimeError("API ECI: recordsFound mancante o non valido") from exc
            if expected_total <= 0:
                raise RuntimeError("API ECI: nessuna iniziativa ONGOING restituita; sync bloccato fail-closed")

        if not batch:
            break

        for item in batch:
            if not isinstance(item, dict):
                raise RuntimeError("API ECI: entry non-oggetto")
            if item.get("status") != STATUS:
                raise RuntimeError(f"API ECI: status inatteso {item.get('status')!r} nel feed ONGOING")
            item_id = item.get("id")
            if item_id in seen_ids:
                continue
            seen_ids.add(item_id)
            entries.append(item)

        if len(entries) >= expected_total:
            break
        offset += len(batch)
        if offset > 10000:
            raise RuntimeError("API ECI: offset oltre il limite di sicurezza")

    if expected_total is None or len(entries) != expected_total:
        raise RuntimeError(
            f"API ECI incompleta: attesi {expected_total}, ricevuti {len(entries)} record unici"
        )
    return entries


def _fetch_detail(year: str, number: str, *, session=None) -> dict:
    return _request_json(
        "GET",
        f"{REGISTER_API}/details/{year}/{number}",
        session=session,
    )


def _choose_version(detail: dict) -> dict:
    versions = detail.get("linguisticVersions")
    if not isinstance(versions, list) or not versions:
        return {}

    for version in versions:
        if isinstance(version, dict) and str(version.get("languageCode", "")).upper() == LANGUAGE:
            return version
    for version in versions:
        if isinstance(version, dict) and version.get("original") is True:
            return version
    for version in versions:
        if isinstance(version, dict) and str(version.get("languageCode", "")).upper() == "EN":
            return version
    return next((version for version in versions if isinstance(version, dict)), {})


def _normalize_number(value: Any) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError) as exc:
        raise RuntimeError(f"Numero firme ufficiale non valido: {value!r}") from exc
    if number < 0:
        raise RuntimeError(f"Numero firme ufficiale negativo: {number}")
    return number


def _normalize_identity(entry: dict) -> Tuple[str, str]:
    year = str(entry.get("year") or "").strip()
    number = str(entry.get("number") or "").strip()
    if not re.fullmatch(r"\d{4}", year) or not re.fullmatch(r"\d{6}", number):
        pub_reg = str(entry.get("pubRegNum") or "")
        match = re.fullmatch(r"ECI\((\d{4})\)(\d{6})", pub_reg)
        if not match:
            raise RuntimeError(f"Identificatore ECI ufficiale non valido: {pub_reg!r}")
        year, number = match.groups()
    return year, number


def _normalize_record(entry: dict, detail: dict) -> Tuple[str, str, int, str, str, Optional[str], Optional[str], str]:
    year, number = _normalize_identity(entry)
    if detail.get("status") != STATUS:
        raise RuntimeError(f"Dettaglio {year}/{number}: status {detail.get('status')!r} non ONGOING")

    version = _choose_version(detail)
    title = str(version.get("title") or entry.get("title") or "").strip()
    if not title:
        raise RuntimeError(f"Dettaglio {year}/{number}: titolo mancante")

    supporters = _normalize_number(entry.get("totalSupporters", 0))
    deadline = _parse_eu_date(detail.get("deadline"))
    if detail.get("deadline") and not deadline:
        raise RuntimeError(f"Dettaglio {year}/{number}: scadenza non valida {detail.get('deadline')!r}")

    objectives = _strip_html(version.get("objectives"))
    support_link = str(version.get("supportLink") or entry.get("supportLink") or "").strip()
    detail_url = f"{PORTAL_BASE}/initiatives/details/{year}/{number}_it"
    official_url = support_link if support_link.startswith("https://") else detail_url

    eid = f"{year}-{number}"
    slug = f"eci-{eid}"
    return (
        eid,
        title[:500],
        supporters,
        slug,
        STATUS,
        deadline,
        objectives,
        official_url,
    )


def fetch_official_records(*, session=None) -> List[Tuple[str, str, int, str, str, Optional[str], Optional[str], str]]:
    entries = _fetch_ongoing_entries(session=session)
    records = []
    for index, entry in enumerate(entries, start=1):
        year, number = _normalize_identity(entry)
        detail = _fetch_detail(year, number, session=session)
        record = _normalize_record(entry, detail)
        records.append(record)
        print(
            f"    [{index}/{len(entries)}] {record[0]} | {record[2]} firme | "
            f"scadenza {record[5] or '—'} | {record[1][:60]}"
        )

    ids = [record[0] for record in records]
    if len(ids) != len(set(ids)):
        raise RuntimeError("API ECI: identificatori duplicati dopo la normalizzazione")
    if len(records) != len(entries):
        raise RuntimeError("API ECI: il set normalizzato non coincide con il feed ufficiale")
    return records


def _replace_cache(database_url: str, records: Sequence[tuple]) -> None:
    if not database_url:
        raise RuntimeError("DATABASE_URL mancante")
    if not records:
        raise RuntimeError("Rifiutata sostituzione cache ECI con dataset vuoto")

    try:
        import psycopg2
        from psycopg2.extras import execute_values
    except ImportError as exc:  # pragma: no cover - dependency error is integration-only
        raise RuntimeError("Dipendenza psycopg2-binary mancante") from exc

    conn = psycopg2.connect(database_url, connect_timeout=10)
    try:
        with conn:
            with conn.cursor() as cur:
                # La cache eci viene sostituita interamente a ogni sync.
                # Non usare trigger INSERT per riconoscere le novita'.
                collection_enabled = os.environ.get("CIVIC_NEW_INITIATIVE_EVENTS_ENABLED") == "true"
                previous_ids = set()
                if collection_enabled:
                    cur.execute("SELECT id FROM eci")
                    previous_ids = {str(row[0]) for row in cur.fetchall()}
                cur.execute("DELETE FROM eci")
                execute_values(
                    cur,
                    """
                    INSERT INTO eci
                      (id, title, signature_count, slug, status, end_date, obiettivi, url)
                    VALUES %s
                    """,
                    records,
                )
                cur.execute("SELECT COUNT(*) FROM eci WHERE status = %s", (STATUS,))
                stored_count = int(cur.fetchone()[0])
                if stored_count != len(records):
                    raise RuntimeError(
                        f"Verifica cache ECI fallita: attesi {len(records)}, trovati {stored_count}"
                    )
                if collection_enabled:
                    # The guard row lock makes this source sync serializable with
                    # the emergency rollback's guard UPDATE, even across jobs.
                    # Once STOP is committed, no catch-up push can be created.
                    cur.execute(
                        "SELECT blocked, reason_code FROM civic_push_delivery_guard WHERE id=1 FOR SHARE"
                    )
                    guard = cur.fetchone()
                    if guard is None:
                        raise RuntimeError("CIVIC_DELIVERY_GUARD_NOT_INITIALIZED")
                    event_status = (
                        "suppressed" if guard[0] is True or guard[1] == "EMERGENCY_STOP" else "pending"
                    )
                    new_records = [
                        ("eci", row[0], row[1], "/eci", event_status)
                        for row in records if row[0] not in previous_ids
                    ]
                    if new_records:
                        # La migrazione pre-carica gli ID storici come suppressed.
                        # UNIQUE impedisce avvisi quando un'ECI sparisce e riappare.
                        execute_values(
                            cur,
                            """
                            INSERT INTO civic_new_initiative_notifications
                              (category, official_id, title, target_path, status)
                            VALUES %s
                            ON CONFLICT (category, official_id) DO NOTHING
                            """,
                            new_records,
                        )
    finally:
        conn.close()


def sync(*, dry_run: bool = False, database_url: Optional[str] = None, session=None) -> int:
    print("[*] ECI: lettura API ufficiale UE (solo status ONGOING)...")
    records = fetch_official_records(session=session)
    print(f"[OK] API ufficiale validata: {len(records)} iniziative ONGOING complete.")

    if dry_run:
        print("[DRY-RUN] Nessuna scrittura database eseguita.")
        return len(records)

    target_database = database_url or os.environ.get("DATABASE_URL")
    if not target_database:
        raise RuntimeError("DATABASE_URL mancante")

    print(f"[*] Sostituzione atomica cache ECI: {len(records)} record...")
    _replace_cache(target_database, records)
    print(f"[SUCCESS] Cache ECI aggiornata e verificata: {len(records)} record ONGOING.")
    return len(records)


def _parse_args(argv: Optional[Sequence[str]] = None):
    parser = argparse.ArgumentParser(description="Sync delle ICE ufficiali attualmente in raccolta")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="verifica sorgente, dettagli e normalizzazione senza scrivere sul database",
    )
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = _parse_args(argv)
    try:
        sync(dry_run=args.dry_run)
        return 0
    except Exception as exc:
        print(f"[ERR] Sync ECI fallito: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
