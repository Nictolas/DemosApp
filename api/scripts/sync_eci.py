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


def _parse_scadenza(text):
    """Estrae 'Scadenza: DD/MM/YYYY' e ritorna 'YYYY-MM-DD' o None."""
    m = re.search(r"Scadenza\s*:\s*(\d{1,2})/(\d{1,2})/(\d{4})", text, re.IGNORECASE)
    if m:
        d, mon, y = m.group(1).zfill(2), m.group(2).zfill(2), m.group(3)
        try:
            return f"{y}-{mon}-{d}"
        except Exception:
            return None
    return None


def _extract_obiettivi(soup):
    """Estrae il testo della sezione Obiettivi dalla pagina di dettaglio."""
    text_full = soup.get_text(" ", strip=True)
    m = re.search(r"Obiettivi\s*(.+?)(?=Informazioni|Clausola|Scadenza|Numero totale|$)", text_full, re.DOTALL | re.IGNORECASE)
    if m:
        block = (m.group(1) or "").strip()
        block = re.sub(r"\s+", " ", block)[:8000]
        return block if len(block) > 10 else None
    return None


def _scrape_detail(html, eid):
    """Estrae titolo, firme, scadenza e obiettivi dalla pagina di dettaglio (HTML già renderizzato)."""
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(" ", strip=True)

    title = "Senza titolo"
    for h1 in soup.find_all("h1"):
        t = (h1.get_text() or "").strip()
        if t and len(t) > 15 and "informazioni" not in t.lower()[:25] and "iniziativa dei cittadini" not in t.lower()[:30]:
            title = t[:500]
            break
    if title == "Senza titolo":
        main = soup.find(attrs={"role": "main"}) or soup.find("main")
        if main:
            for h in main.find_all(["h1", "h2"]):
                t = (h.get_text() or "").strip()
                if t and len(t) > 15 and "iniziativa" not in t.lower()[:20]:
                    title = t[:500]
                    break
    if title == "Senza titolo":
        meta = soup.find("meta", property="og:title")
        if meta and meta.get("content"):
            title = (meta["content"] or "").strip()[:500] or title

    count = 0
    for pattern in [
        r"Numero totale di firmatari\s*[\s\t]*([\d.,]+)",
        r"firmatari\s+([\d.,]+)",
        r"([\d.,]+)\s*(?:firmatari|firme|supporti|signature)",
        r"(?:firme|supporti|signature)[:\s]*([\d.,]+)",
    ]:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            raw = m.group(1).replace(".", "").replace(",", "")
            if raw.isdigit():
                count = int(raw)
                break

    end_date = _parse_scadenza(text)
    obiettivi = _extract_obiettivi(soup)
    return title, count, end_date, obiettivi


def _fetch_list_html():
    """Ritorna HTML della pagina lista (solo requests)."""
    return _get_html(LIST_URL, LIST_PARAMS)


def _fetch_html_playwright(url, wait_extra=2):
    """Rende la pagina con Playwright e ritorna HTML (per liste e dettagli JS-rendered)."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return None
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url, wait_until="networkidle", timeout=25000)
        time.sleep(wait_extra)
        html = page.content()
        browser.close()
    return html


def _fetch_list_html_playwright():
    """Fallback: rende la pagina lista con Playwright."""
    return _fetch_html_playwright(
        f"{LIST_URL}?CATEGORY%5B0%5D=any&STATUS%5B0%5D=ONGOING&SECTION=ALL"
    )


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

    print(f"[OK] Trovate {len(detail_links)} iniziative. Scraping dettagli (Playwright per contenuto reale)...")

    to_insert = []
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("[ERR] Playwright non disponibile. Installa: pip install playwright && playwright install chromium")
        return

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for i, item in enumerate(detail_links):
            try:
                page = browser.new_page()
                page.goto(item["url"], wait_until="networkidle", timeout=20000)
                time.sleep(1)
                html_detail = page.content()
                page.close()
                title, count, end_date, obiettivi = _scrape_detail(html_detail, item["eid"])
                status = "SUCCESS" if count >= 1000000 else "ONGOING"
                slug = f"eci-{item['eid']}"
                url = item["url"]
                to_insert.append((item["eid"], title, count, slug, status, end_date, obiettivi, url))
                print(f"    [{item['eid']}] {title[:50]}... | {count} firme | scadenza {end_date or '—'}")
            except Exception as e:
                print(f"[!] Saltata {item['url']}: {e}")
            time.sleep(0.5)
        browser.close()

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
            "INSERT INTO eci (id, title, signature_count, slug, status, end_date, obiettivi, url) VALUES %s",
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
