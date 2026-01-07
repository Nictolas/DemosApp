#!/usr/bin/env python3
"""
Script per estrarre le votazioni più recenti dei deputati dalla Camera
e salvarle nella tabella voti_camera del database PostgreSQL (Neon).
"""

import os
import sys
import re
from datetime import datetime
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

# Carica le variabili d'ambiente dal file .env
load_dotenv()

# Configurazione database
DB_HOST = os.getenv('DB_HOST')
DB_USER = os.getenv('DB_USER')
DB_PASSWORD = os.getenv('DB_PASSWORD')
DB_NAME = os.getenv('DB_NAME', 'neondb')

# URL del sito
URL_VOTAZIONI = "https://documenti.camera.it/apps/votazioni/votazionitutte/FormVotazioni.Asp"


def connect_db():
    """Crea una connessione al database PostgreSQL."""
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            sslmode='require'
        )
        return conn
    except Exception as e:
        print(f"❌ Errore nella connessione al database: {e}")
        sys.exit(1)


def save_votazione(conn, politico_nome, data_votazione, oggetto_voto, esito_voto):
    """Salva o aggiorna una votazione nel database."""
    try:
        with conn.cursor() as cur:
            query = """
                INSERT INTO voti_camera (politico_nome, data_votazione, oggetto_voto, esito_voto)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (politico_nome) 
                DO UPDATE SET 
                    data_votazione = EXCLUDED.data_votazione,
                    oggetto_voto = EXCLUDED.oggetto_voto,
                    esito_voto = EXCLUDED.esito_voto
            """
            cur.execute(query, (politico_nome, data_votazione, oggetto_voto, esito_voto))
            conn.commit()
            return True
    except Exception as e:
        print(f"❌ Errore nel salvataggio della votazione per {politico_nome}: {e}")
        conn.rollback()
        return False


def parse_data_votazione(data_str):
    """Converte una stringa di data in formato DATE per PostgreSQL."""
    try:
        # Prova vari formati di data comuni
        formats = [
            '%d/%m/%Y',
            '%Y-%m-%d',
            '%d-%m-%Y',
            '%d %m %Y',
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(data_str.strip(), fmt).date()
            except ValueError:
                continue
        
        # Se nessun formato funziona, restituisci None
        print(f"⚠️  Formato data non riconosciuto: {data_str}")
        return None
    except Exception as e:
        print(f"⚠️  Errore nel parsing della data '{data_str}': {e}")
        return None


def extract_votazione_recente(page, politico_nome):
    """
    Estrae la votazione più recente (prima riga) per un deputato.
    Restituisce un dizionario con i dati o None se non trovato.
    """
    try:
        # Attendi che la tabella dei risultati sia caricata
        page.wait_for_selector('table', timeout=10000)
        
        # Trova la prima riga della tabella (escludendo l'header)
        rows = page.query_selector_all('table tr')
        
        if len(rows) < 2:  # Meno di 2 righe significa solo header o nessun risultato
            print(f"⚠️  Nessun risultato trovato per {politico_nome}")
            return None
        
        # Prendi la prima riga di dati (indice 1, saltando l'header)
        first_row = rows[1]
        cells = first_row.query_selector_all('td')
        
        if len(cells) < 3:
            print(f"⚠️  Struttura tabella non valida per {politico_nome}")
            return None
        
        # Estrai i dati dalle celle (adatta gli indici in base alla struttura reale)
        # Assumiamo: [0]=Data, [1]=Oggetto, [2]=Esito (o simile)
        data_votazione_str = cells[0].inner_text().strip() if len(cells) > 0 else ""
        oggetto_voto = cells[1].inner_text().strip() if len(cells) > 1 else ""
        esito_voto = cells[2].inner_text().strip() if len(cells) > 2 else ""
        
        # Converti la data
        data_votazione = parse_data_votazione(data_votazione_str)
        
        if not data_votazione:
            print(f"⚠️  Data non valida per {politico_nome}: {data_votazione_str}")
            return None
        
        return {
            'politico_nome': politico_nome,
            'data_votazione': data_votazione,
            'oggetto_voto': oggetto_voto,
            'esito_voto': esito_voto
        }
        
    except PlaywrightTimeoutError:
        print(f"⚠️  Timeout nell'attesa dei risultati per {politico_nome}")
        return None
    except Exception as e:
        print(f"❌ Errore nell'estrazione dati per {politico_nome}: {e}")
        return None


def get_deputati_list(page):
    """Estrae la lista di tutti i deputati dal menu a tendina."""
    try:
        # Trova il menu a tendina dei deputati
        # Il selettore potrebbe variare, prova alcuni pattern comuni
        selectors = [
            'select[name*="deputato"]',
            'select[name*="Deputato"]',
            'select[name*="politico"]',
            'select[id*="deputato"]',
            'select[id*="Deputato"]',
            'select',
        ]
        
        select_element = None
        for selector in selectors:
            try:
                select_element = page.query_selector(selector)
                if select_element:
                    break
            except:
                continue
        
        if not select_element:
            print("❌ Menu a tendina dei deputati non trovato")
            return []
        
        # Estrai tutte le opzioni
        options = select_element.query_selector_all('option')
        deputati = []
        
        for option in options:
            value = option.get_attribute('value')
            text = option.inner_text().strip()
            
            # Salta l'opzione vuota o di default
            if value and value != '' and text and text != '' and text.lower() != 'seleziona':
                deputati.append({
                    'value': value,
                    'nome': text
                })
        
        print(f"✅ Trovati {len(deputati)} deputati nel menu")
        return deputati
        
    except Exception as e:
        print(f"❌ Errore nell'estrazione della lista deputati: {e}")
        return []


def scrape_votazioni():
    """Funzione principale per lo scraping delle votazioni."""
    # Verifica le variabili d'ambiente
    if not all([DB_HOST, DB_USER, DB_PASSWORD]):
        print("❌ Errore: Configura DB_HOST, DB_USER e DB_PASSWORD nel file .env")
        sys.exit(1)
    
    # Connetti al database
    print("🔌 Connessione al database...")
    conn = connect_db()
    print("✅ Connesso al database")
    
    # Avvia Playwright
    with sync_playwright() as p:
        print("🚀 Avvio del browser...")
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        try:
            print(f"📡 Navigazione verso {URL_VOTAZIONI}...")
            page.goto(URL_VOTAZIONI, wait_until='networkidle', timeout=30000)
            print("✅ Pagina caricata")
            
            # Estrai la lista dei deputati
            print("🔍 Estrazione lista deputati...")
            deputati = get_deputati_list(page)
            
            if not deputati:
                print("❌ Nessun deputato trovato. Verifica il selettore del menu.")
                browser.close()
                conn.close()
                return
            
            # Processa ogni deputato
            total = len(deputati)
            successi = 0
            errori = 0
            
            print(f"\n📊 Inizio estrazione votazioni per {total} deputati...\n")
            
            for idx, deputato in enumerate(deputati, 1):
                politico_nome = deputato['nome']
                print(f"[{idx}/{total}] Elaborazione: {politico_nome}...", end=' ')
                
                try:
                    # Seleziona il deputato dal menu
                    select_selector = 'select[name*="deputato"], select[name*="Deputato"], select[name*="politico"], select[id*="deputato"], select[id*="Deputato"], select'
                    select_element = page.query_selector(select_selector)
                    
                    if not select_element:
                        print("❌ Menu non trovato")
                        errori += 1
                        continue
                    
                    # Seleziona il deputato
                    select_element.select_option(value=deputato['value'])
                    
                    # Attendi che i risultati si aggiornino
                    page.wait_for_timeout(2000)  # Attendi 2 secondi per il caricamento
                    
                    # Estrai la votazione più recente
                    votazione = extract_votazione_recente(page, politico_nome)
                    
                    if votazione:
                        # Salva nel database
                        if save_votazione(
                            conn,
                            votazione['politico_nome'],
                            votazione['data_votazione'],
                            votazione['oggetto_voto'],
                            votazione['esito_voto']
                        ):
                            print(f"✅ Salvato: {votazione['data_votazione']} - {votazione['oggetto_voto'][:50]}...")
                            successi += 1
                        else:
                            errori += 1
                    else:
                        print("⚠️  Nessuna votazione trovata")
                        errori += 1
                        
                except Exception as e:
                    print(f"❌ Errore: {e}")
                    errori += 1
                    continue
            
            # Riepilogo
            print(f"\n{'='*60}")
            print(f"📊 RIEPILOGO")
            print(f"{'='*60}")
            print(f"✅ Successi: {successi}")
            print(f"❌ Errori: {errori}")
            print(f"📈 Totale: {total}")
            print(f"{'='*60}\n")
            
        except Exception as e:
            print(f"❌ Errore durante lo scraping: {e}")
            import traceback
            traceback.print_exc()
        finally:
            browser.close()
            conn.close()
            print("🔌 Connessioni chiuse")


if __name__ == "__main__":
    scrape_votazioni()

