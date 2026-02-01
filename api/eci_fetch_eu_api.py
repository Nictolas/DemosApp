#!/usr/bin/env python3
"""
Script per recuperare in tempo reale i dati delle Iniziative dei Cittadini Europei (ECI)
tramite le API ufficiali della Commissione Europea.

Endpoint (query params):
- In corso: https://citizens-initiative.europa.eu/api/initiatives/search?section=ONGOING&language=it&page=0&pageSize=100
- Tutte (per successi): https://citizens-initiative.europa.eu/api/initiatives/search?section=ALL&language=it&page=0&pageSize=100
"""

import requests
import locale
import sys

# Separatore migliaia in stile italiano (1.234.567)
try:
    locale.setlocale(locale.LC_NUMERIC, "it_IT.UTF-8")
except locale.Error:
    pass


def format_number(n):
    """Formatta il numero con separatore delle migliaia (es. 1.234.567)."""
    if n is None:
        return "0"
    return f"{int(n):,}".replace(",", ".")


def extract_list(data):
    """Estrae la lista di iniziative dalla risposta JSON (struttura flessibile)."""
    if isinstance(data, list):
        return data
    for key in ("content", "items", "initiatives", "data", "results", "searchResult"):
        if isinstance(data.get(key), list):
            return data[key]
    if "searchResult" in data and isinstance(data["searchResult"], dict):
        return data["searchResult"].get("content", data["searchResult"].get("items", []))
    return []


def get_title(item):
    """Estrae il titolo da un oggetto iniziativa."""
    for key in ("title", "initiativeTitle", "name", "titleEn", "titleIt"):
        val = item.get(key)
        if val and isinstance(val, str):
            return val
        if isinstance(val, dict):
            return val.get("it") or val.get("en") or val.get("title") or str(val)
    return "(Senza titolo)"


def get_supporters(item):
    """Estrae il numero di sostenitori/firme."""
    for key in ("totalSupporters", "supporters", "signatures", "signatureCount", "count"):
        val = item.get(key)
        if val is not None:
            try:
                return int(val)
            except (TypeError, ValueError):
                pass
    return 0


def fetch_eci(endpoint, label):
    """Esegue la richiesta GET e restituisce la lista di iniziative."""
    try:
        r = requests.get(endpoint, timeout=15)
        r.raise_for_status()
        data = r.json()
        return extract_list(data)
    except requests.exceptions.RequestException as e:
        print(f"  [ERRORE {label}] Connessione fallita: {e}", file=sys.stderr)
        return []
    except ValueError as e:
        print(f"  [ERRORE {label}] Risposta non JSON: {e}", file=sys.stderr)
        return []


def main():
    BASE = "https://citizens-initiative.europa.eu/api/initiatives/search"
    ONGOING_URL = f"{BASE}?section=ONGOING&language=it&page=0&pageSize=100"
    ALL_URL = f"{BASE}?section=ALL&language=it&page=0&pageSize=100"

    print("=" * 70)
    print("  INIZIATIVE DEI CITTADINI EUROPEI (ECI) - Dati in tempo reale")
    print("=" * 70)

    # --- IN CORSO ---
    print("\n  ► IN CORSO\n")
    ongoing = fetch_eci(ONGOING_URL, "ONGOING")
    if not ongoing:
        print("    Nessuna iniziativa in corso o errore di connessione.\n")
    else:
        for item in ongoing:
            title = get_title(item)
            supporters = get_supporters(item)
            print(f"    [{format_number(supporters):>12}]  -  {title}")
        print(f"\n    Totale: {len(ongoing)} iniziative in corso.\n")

    # --- SUCCESSI (> 1 MILIONE) ---
    print("  ► SUCCESSI (totalSupporters >= 1.000.000)\n")
    all_items = fetch_eci(ALL_URL, "ALL")
    successi = [i for i in all_items if get_supporters(i) >= 1_000_000]
    successi.sort(key=lambda x: get_supporters(x), reverse=True)

    if not successi:
        print("    Nessuna iniziativa con almeno 1 milione di firme (o errore di connessione).\n")
    else:
        for item in successi:
            title = get_title(item)
            supporters = get_supporters(item)
            print(f"    [{format_number(supporters):>12}]  -  {title}")
        print(f"\n    Totale: {len(successi)} iniziative con >= 1.000.000 firme.\n")

    print("=" * 70)


if __name__ == "__main__":
    main()
