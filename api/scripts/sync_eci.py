#!/usr/bin/env python3
"""
Sincronizza le Iniziative dei Cittadini Europei (ECI) dall'API EU verso la tabella Neon eci.
L'API EU richiede User-Agent e Accept per evitare 404.
Eseguito da GitHub Actions ogni 6 ore (workflow eci_sync.yml).
"""

import os
import sys

try:
    import requests
    import psycopg2
except ImportError as e:
    print(f"[ERR] Dipendenze mancanti: {e}", file=sys.stderr)
    print("Esegui: pip install requests psycopg2-binary", file=sys.stderr)
    sys.exit(1)

# Carica .env se presente (locale); in CI usa DATABASE_URL dai secrets
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

ECI_API_URL = "https://citizens-initiative.europa.eu/api/initiatives/search?section=ALL&language=it&page=0&pageSize=100"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
}


def get_entries(data):
    """Estrae la lista di iniziative dal JSON (campo entries o varianti)."""
    if not data or not isinstance(data, dict):
        return []
    for key in ("entries", "content", "items", "initiatives", "data", "results"):
        val = data.get(key)
        if isinstance(val, list):
            return val
        if isinstance(val, dict) and isinstance(val.get("content"), list):
            return val["content"]
    return []


def row_from_entry(entry):
    """Mappa un elemento del JSON a (id, title, signature_count, slug)."""
    eid = entry.get("id")
    if eid is None:
        return None
    eid = str(eid).strip()
    if not eid:
        return None
    title = entry.get("title")
    if isinstance(title, dict):
        title = title.get("it") or title.get("en") or title.get("title") or ""
    title = (title or "").strip() or "Senza titolo"
    # Firma: signatureCount o totalSupporters (verificato dall'API)
    count = entry.get("signatureCount")
    if count is None:
        count = entry.get("totalSupporters")
    if count is None:
        count = 0
    try:
        count = int(count)
    except (TypeError, ValueError):
        count = 0
    slug = entry.get("slug") or eid
    if isinstance(slug, str):
        slug = slug.strip() or eid
    else:
        slug = eid
    return (eid, title, count, slug)


def main():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("[ERR] DATABASE_URL non impostata.", file=sys.stderr)
        sys.exit(1)

    # 1) Fetch API EU con header corretti
    print("[*] Richiesta API EU ECI...")
    try:
        r = requests.get(ECI_API_URL, headers=HEADERS, timeout=30)
        r.raise_for_status()
    except requests.RequestException as e:
        print(f"[ERR] Richiesta API fallita: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        data = r.json()
    except ValueError as e:
        print(f"[ERR] Risposta non JSON: {e}", file=sys.stderr)
        sys.exit(1)

    entries = get_entries(data)
    rows = []
    for entry in entries:
        row = row_from_entry(entry)
        if row:
            rows.append(row)

    # Verifica finale: stampa a video prima di caricare sul DB
    print("Connessione riuscita")
    print(f"Iniziative trovate: {len(rows)}")

    # 2) Connessione a Neon: svuota eci e inserisci risultati
    try:
        conn = psycopg2.connect(database_url)
        conn.autocommit = False
        cur = conn.cursor()
        cur.execute("DELETE FROM eci")
        for (eid, title, count, slug) in rows:
            cur.execute(
                """
                INSERT INTO eci (id, title, signature_count, slug, updated_at)
                VALUES (%s, %s, %s, %s, NOW())
                ON CONFLICT (id) DO UPDATE SET
                  title = EXCLUDED.title,
                  signature_count = EXCLUDED.signature_count,
                  slug = EXCLUDED.slug,
                  updated_at = NOW()
                """,
                (eid, title, count, slug),
            )
        conn.commit()
        cur.close()
        conn.close()
        print(f"[OK] Tabella eci aggiornata: {len(rows)} iniziative.")
    except Exception as e:
        print(f"[ERR] Database: {e}", file=sys.stderr)
        sys.exit(1)

    return 0


if __name__ == "__main__":
    sys.exit(main())
