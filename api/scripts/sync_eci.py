"""
Sync ECI via scraping HTML: lista iniziative in corso → link dettaglio → scrape titolo/firme → DB.
Fallback Playwright se la lista è caricata via JavaScript.
"""
import os
import re
import time
import requests
from bs4 import BeautifulSoup
import psycopg2
from psycopg2.extras import execute_values

BASE = "https://citizens-initiative.europa.eu"
LIST_URL = f"{BASE}/find-initiative_it"
LIST_PARAMS = {"CATEGORY[0]": "any", "STATUS[0]": "ONGOING", "SECTION": "ALL"}
DATABASE_URL = os.environ.get("DATABASE_URL")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9",
}


def _get_html(url, params=None):
    r = requests.get(url, headers=HEADERS, params=params, timeout=25)
    r.raise_for_status()
    return r.text


def _extract_detail_links(html):
    """Estrae URL di dettaglio dal HTML della pagina lista (es. /initiatives/details/2025/000005_it)."""
    soup = BeautifulSoup(html, "html.parser")
    links = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        m = re.search(r"/initiatives/details/(\d{4})/(\d+)_it", href)
        if m:
            year, num = m.group(1), m.group(2)
            key = (year, num)
            if key not in seen:
                seen.add(key)
                full = href if href.startswith("http") else BASE.rstrip("/") + "/" + href.lstrip("/")
                links.append({"url": full, "year": year, "num": num, "eid": f"{year}-{num}"})
    return links


def _scrape_detail(html, eid):
    """Estrae titolo e numero firme dalla pagina di dettaglio."""
    soup = BeautifulSoup(html, "html.parser")

    title = "Senza titolo"
    for h1 in soup.find_all("h1"):
        t = (h1.get_text() or "").strip()
        if t and len(t) > 2 and "iniziativa" not in t.lower()[:30]:
            title = t[:500]
            break
    if title == "Senza titolo":
        meta = soup.find("meta", property="og:title")
        if meta and meta.get("content"):
            title = (meta["content"] or "").strip()[:500] or title

    count = 0
    text = soup.get_text(" ", strip=True)
    # Cerca numero con separatori migliaia (1.234.567 o 1,234,567) vicino a "firme" / "supporti"
    for pattern in [
        r"([\d.,]+)\s*(?:firme|supporti|signature)",
        r"(?:firme|supporti|signature)[:\s]*([\d.,]+)",
        r"([\d]{1,3}(?:[.,]\d{3})*)\s*(?:firme|supporti)",
    ]:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            raw = m.group(1).replace(".", "").replace(",", "")
            if raw.isdigit():
                count = int(raw)
                break
    if count == 0 and "firme" in text.lower():
        m = re.search(r"(\d[\d.,]*)\s*firme", text, re.IGNORECASE)
        if m:
            raw = m.group(1).replace(".", "").replace(",", "")
            if raw.isdigit():
                count = int(raw)

    return title, count


def _fetch_list_html():
    """Ritorna HTML della pagina lista (solo requests)."""
    return _get_html(LIST_URL, LIST_PARAMS)


def _fetch_list_html_playwright():
    """Fallback: rende la pagina lista con Playwright e ritorna HTML (se lista vuota con requests)."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return None
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(f"{LIST_URL}?CATEGORY%5B0%5D=any&STATUS%5B0%5D=ONGOING&SECTION=ALL", wait_until="networkidle", timeout=25000)
        time.sleep(2)
        html = page.content()
        browser.close()
    return html


def sync():
    if not DATABASE_URL:
        print("[ERR] Manca DATABASE_URL.")
        return

    print("[*] Fase 1: Caricamento pagina lista (iniziative in corso)...")
    try:
        html_list = _fetch_list_html()
    except Exception as e:
        print(f"[ERR] Lista non scaricabile: {e}")
        return

    detail_links = _extract_detail_links(html_list)
    if not detail_links:
        print("[!] Nessun link nella lista (probabile rendering JS). Provo con Playwright...")
        try:
            html_list = _fetch_list_html_playwright()
            if html_list:
                detail_links = _extract_detail_links(html_list)
        except Exception as e:
            print(f"[!] Playwright fallito: {e}")
    if not detail_links:
        print("[ERR] Impossibile ottenere link alle iniziative.")
        return

    print(f"[OK] Trovate {len(detail_links)} iniziative. Scraping dettagli...")

    to_insert = []
    for i, item in enumerate(detail_links):
        try:
            html_detail = _get_html(item["url"])
            title, count = _scrape_detail(html_detail, item["eid"])
            status = "SUCCESS" if count >= 1000000 else "ONGOING"
            slug = f"eci-{item['eid']}"
            to_insert.append((item["eid"], title, count, slug, status))
        except Exception as e:
            print(f"[!] Saltata {item['url']}: {e}")
        time.sleep(0.5)

    if not to_insert:
        print("[ERR] Nessun dettaglio estratto.")
        return

    print(f"[OK] Dati pronti: {len(to_insert)} iniziative. Scrittura su Neon...")
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute("DELETE FROM eci")
        execute_values(
            cur,
            "INSERT INTO eci (id, title, signature_count, slug, status) VALUES %s",
            to_insert,
        )
        conn.commit()
        cur.close()
        conn.close()
        print(f"[SUCCESS] Database popolato con {len(to_insert)} ECI (scraping).")
    except Exception as e:
        print(f"[ERR] Database: {e}")


if __name__ == "__main__":
    sync()
