#!/usr/bin/env python3
# -*- coding: utf-8 -*-
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
from psycopg2 import errors as psycopg2_errors
from psycopg2.extras import RealDictCursor
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

# Configura encoding per Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Carica le variabili d'ambiente dal file .env
load_dotenv()

# Configurazione database - supporta sia DATABASE_URL che variabili separate
DATABASE_URL = os.getenv('DATABASE_URL')
DB_HOST = os.getenv('DB_HOST')
DB_USER = os.getenv('DB_USER')
DB_PASSWORD = os.getenv('DB_PASSWORD')
DB_NAME = os.getenv('DB_NAME', 'neondb')

# URL del sito - usa la legislatura 19 (XIX legislatura attuale)
# Per altre legislature, cambia il parametro Legislatura (es. 18 per XVIII)
LEGISLATURA = os.getenv('LEGISLATURA', '19')  # Default: 19 (XIX legislatura)
URL_VOTAZIONI = f"https://documenti.camera.it/apps/votazioni/votazionitutte/FormVotazioni.Asp?Legislatura={LEGISLATURA}"


def connect_db():
    """Crea una connessione al database PostgreSQL."""
    try:
        if DATABASE_URL:
            # Usa DATABASE_URL se disponibile
            conn = psycopg2.connect(DATABASE_URL)
        elif all([DB_HOST, DB_USER, DB_PASSWORD]):
            # Altrimenti usa le variabili separate
            conn = psycopg2.connect(
                host=DB_HOST,
                user=DB_USER,
                password=DB_PASSWORD,
                database=DB_NAME,
                sslmode='require'
            )
        else:
            raise ValueError("Configura DATABASE_URL o DB_HOST, DB_USER, DB_PASSWORD nel file .env")
        return conn
    except Exception as e:
        print(f"❌ Errore nella connessione al database: {e}")
        sys.exit(1)


def save_votazione(conn, politico_nome, data_votazione, oggetto_voto, esito_voto):
    """Salva o aggiorna una votazione nel database."""
    try:
        with conn.cursor() as cur:
            # Verifica se esiste un constraint UNIQUE su politico_nome
            # Se non esiste, usa INSERT semplice con controllo manuale
            try:
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
            except psycopg2_errors.UniqueViolation:
                # Se c'è un conflitto ma ON CONFLICT non funziona, usa UPDATE
                query = """
                    UPDATE voti_camera 
                    SET data_votazione = %s,
                        oggetto_voto = %s,
                        esito_voto = %s
                    WHERE politico_nome = %s
                """
                cur.execute(query, (data_votazione, oggetto_voto, esito_voto, politico_nome))
                if cur.rowcount == 0:
                    # Se non esiste, inserisci
                    query = """
                        INSERT INTO voti_camera (politico_nome, data_votazione, oggetto_voto, esito_voto)
                        VALUES (%s, %s, %s, %s)
                    """
                    cur.execute(query, (politico_nome, data_votazione, oggetto_voto, esito_voto))
            except psycopg2_errors.UndefinedColumn:
                # Se la colonna non esiste, prova senza ON CONFLICT
                query = """
                    INSERT INTO voti_camera (politico_nome, data_votazione, oggetto_voto, esito_voto)
                    VALUES (%s, %s, %s, %s)
                """
                cur.execute(query, (politico_nome, data_votazione, oggetto_voto, esito_voto))
            
            conn.commit()
            return True
    except Exception as e:
        print(f"❌ Errore nel salvataggio della votazione per {politico_nome}: {e}")
        import traceback
        traceback.print_exc()
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
        # Prova diversi selettori per la tabella
        table_selectors = [
            'table',
            'table.tabella',
            'table.results',
            'table.votazioni',
            '.tabella',
            '#tabella',
            'div table'
        ]
        
        table_element = None
        for selector in table_selectors:
            try:
                page.wait_for_selector(selector, timeout=5000)
                table_element = page.query_selector(selector)
                if table_element:
                    break
            except:
                continue
        
        if not table_element:
            # Prova a vedere se ci sono risultati in un formato diverso
            # A volte i risultati potrebbero essere in una lista o div
            results_div = page.query_selector('.risultati, .results, #risultati')
            if results_div:
                text = results_div.inner_text()
                if 'nessun risultato' in text.lower() or 'no results' in text.lower():
                    return None
            
            print(f"⚠️  Tabella risultati non trovata per {politico_nome}")
            return None
        
        # Trova la prima riga della tabella (escludendo l'header)
        rows = table_element.query_selector_all('tr')
        
        if len(rows) < 2:  # Meno di 2 righe significa solo header o nessun risultato
            print(f"⚠️  Nessun risultato trovato per {politico_nome}")
            return None
        
        # Prendi la prima riga di dati (indice 1, saltando l'header)
        first_row = rows[1]
        cells = first_row.query_selector_all('td, th')
        
        if len(cells) < 2:
            print(f"⚠️  Struttura tabella non valida per {politico_nome} (solo {len(cells)} celle)")
            return None
        
        # Estrai i dati dalle celle - prova diverse combinazioni
        # Possibili strutture:
        # 1. Data, Oggetto, Esito
        # 2. Oggetto, Data, Esito
        # 3. Data, Esito, Oggetto
        # 4. Solo Oggetto e Esito (senza data esplicita)
        
        data_votazione_str = ""
        oggetto_voto = ""
        esito_voto = ""
        
        # Prova a identificare le colonne guardando l'header
        header_row = rows[0] if len(rows) > 0 else None
        header_cells = header_row.query_selector_all('th, td') if header_row else []
        
        # Crea un mapping colonna -> indice
        col_mapping = {}
        for idx, header_cell in enumerate(header_cells):
            header_text = header_cell.inner_text().strip().lower()
            if 'data' in header_text or 'date' in header_text:
                col_mapping['data'] = idx
            elif 'oggetto' in header_text or 'descrizione' in header_text or 'votazione' in header_text:
                col_mapping['oggetto'] = idx
            elif 'esito' in header_text or 'voto' in header_text or 'risultato' in header_text:
                col_mapping['esito'] = idx
        
        # Estrai i dati usando il mapping se disponibile
        if col_mapping:
            if 'data' in col_mapping and col_mapping['data'] < len(cells):
                data_votazione_str = cells[col_mapping['data']].inner_text().strip()
            if 'oggetto' in col_mapping and col_mapping['oggetto'] < len(cells):
                oggetto_voto = cells[col_mapping['oggetto']].inner_text().strip()
            if 'esito' in col_mapping and col_mapping['esito'] < len(cells):
                esito_voto = cells[col_mapping['esito']].inner_text().strip()
        else:
            # Fallback: usa gli indici standard
            # Assumiamo: [0]=Data, [1]=Oggetto, [2]=Esito (o simile)
            if len(cells) > 0:
                data_votazione_str = cells[0].inner_text().strip()
            if len(cells) > 1:
                oggetto_voto = cells[1].inner_text().strip()
            if len(cells) > 2:
                esito_voto = cells[2].inner_text().strip()
        
        # Se non abbiamo trovato l'oggetto, prova a prenderlo dalla prima cella che sembra essere testo
        if not oggetto_voto and len(cells) > 0:
            for cell in cells:
                text = cell.inner_text().strip()
                if text and len(text) > 10:  # Probabilmente è l'oggetto se è lungo
                    oggetto_voto = text
                    break
        
        # Converti la data se presente
        data_votazione = None
        if data_votazione_str:
            data_votazione = parse_data_votazione(data_votazione_str)
        
        # Se non abbiamo una data valida, usa None (sarà NULL nel database)
        # ma continuiamo comunque se abbiamo almeno l'oggetto e l'esito
        
        if not oggetto_voto and not esito_voto:
            print(f"⚠️  Nessun dato valido estratto per {politico_nome}")
            return None
        
        return {
            'politico_nome': politico_nome,
            'data_votazione': data_votazione,
            'oggetto_voto': oggetto_voto or "N/A",
            'esito_voto': esito_voto or "N/A"
        }
        
    except PlaywrightTimeoutError:
        print(f"⚠️  Timeout nell'attesa dei risultati per {politico_nome}")
        return None
    except Exception as e:
        print(f"❌ Errore nell'estrazione dati per {politico_nome}: {e}")
        import traceback
        traceback.print_exc()
        return None


def get_deputati_list(page):
    """Estrae la lista di tutti i deputati dal menu a tendina."""
    try:
        # Trova il menu a tendina dei deputati
        # Il selettore potrebbe variare, prova alcuni pattern comuni
        selectors = [
            'select[name*="nominativo"]',
            'select[name*="Nominativo"]',
            'select[name*="deputato"]',
            'select[name*="Deputato"]',
            'select[name*="politico"]',
            'select[id*="nominativo"]',
            'select[id*="Nominativo"]',
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
            if value and value != '' and text and text != '' and text.lower() != 'seleziona' and text.lower() != 'seleziona il nominativo':
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
    if not DATABASE_URL and not all([DB_HOST, DB_USER, DB_PASSWORD]):
        print("❌ Errore: Configura DATABASE_URL oppure DB_HOST, DB_USER e DB_PASSWORD nel file .env")
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
            
            # Seleziona il tipo votazione "FINALE"
            print("🔍 Selezione tipo votazione: FINALE...")
            try:
                tipo_votazione_selectors = [
                    'select[name*="tipo"]',
                    'select[name*="Tipo"]',
                    'select[name*="votazione"]',
                    'select[name*="Votazione"]',
                    'select[id*="tipo"]',
                    'select[id*="Tipo"]',
                    'select[id*="votazione"]',
                    'select[id*="Votazione"]',
                ]
                
                tipo_select = None
                for selector in tipo_votazione_selectors:
                    try:
                        tipo_select = page.query_selector(selector)
                        if tipo_select:
                            # Verifica che contenga l'opzione FINALE
                            options = tipo_select.query_selector_all('option')
                            has_finale = any('FINALE' in opt.inner_text().upper() for opt in options)
                            if has_finale:
                                break
                            else:
                                tipo_select = None
                    except:
                        continue
                
                if tipo_select:
                    # Prova diversi modi per selezionare FINALE
                    try:
                        tipo_select.select_option(value='FINALE')
                        print("✅ Tipo votazione FINALE selezionato (per value)")
                    except:
                        try:
                            tipo_select.select_option(label='FINALE')
                            print("✅ Tipo votazione FINALE selezionato (per label)")
                        except:
                            # Prova a trovare l'opzione e selezionarla
                            options = tipo_select.query_selector_all('option')
                            for opt in options:
                                if 'FINALE' in opt.inner_text().upper():
                                    opt_value = opt.get_attribute('value')
                                    if opt_value:
                                        tipo_select.select_option(value=opt_value)
                                    print("✅ Tipo votazione FINALE selezionato (per testo)")
                                    break
                else:
                    print("⚠️  Menu tipo votazione non trovato, continuo comunque...")
            except Exception as e:
                print(f"⚠️  Errore nella selezione tipo votazione: {e}")
            
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
                    # Seleziona il deputato dal menu "Nominativo partecipante alla votazione"
                    select_selector = 'select[name*="nominativo"], select[name*="Nominativo"], select[name*="deputato"], select[name*="Deputato"], select[name*="politico"], select[id*="nominativo"], select[id*="Nominativo"], select[id*="deputato"], select[id*="Deputato"], select'
                    select_element = page.query_selector(select_selector)
                    
                    if not select_element:
                        print("❌ Menu non trovato")
                        errori += 1
                        continue
                    
                    # Seleziona il deputato
                    select_element.select_option(value=deputato['value'])
                    page.wait_for_timeout(500)  # Piccola pausa dopo la selezione
                    
                    # Clicca sul pulsante "Avvia la ricerca"
                    try:
                        # Prova diversi selettori per il pulsante di ricerca
                        search_button_selectors = [
                            'input[value*="Avvia"]',
                            'input[value*="avvia"]',
                            'input[value*="ricerca"]',
                            'input[value*="Ricerca"]',
                            'button:has-text("Avvia")',
                            'button:has-text("avvia")',
                            'input[type="submit"]',
                            'button[type="submit"]',
                        ]
                        
                        search_button = None
                        for selector in search_button_selectors:
                            try:
                                search_button = page.query_selector(selector)
                                if search_button:
                                    break
                            except:
                                continue
                        
                        if search_button:
                            search_button.click()
                            print("🔍 Ricerca avviata...", end=' ')
                            # Attendi che i risultati si carichino
                            page.wait_for_timeout(3000)
                            # Attendi anche che la tabella dei risultati appaia
                            try:
                                page.wait_for_selector('table', timeout=10000)
                            except:
                                pass
                        else:
                            print("⚠️  Pulsante ricerca non trovato, aspetto...", end=' ')
                            page.wait_for_timeout(3000)
                    except Exception as e:
                        print(f"⚠️  Errore nel click ricerca: {e}", end=' ')
                        page.wait_for_timeout(3000)
                    
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

