#!/usr/bin/env python3
"""
Script di test per verificare la connessione al database e la struttura della tabella voti_camera.
"""

import os
import sys
from dotenv import load_dotenv
import psycopg2

# Carica le variabili d'ambiente
load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')
DB_HOST = os.getenv('DB_HOST')
DB_USER = os.getenv('DB_USER')
DB_PASSWORD = os.getenv('DB_PASSWORD')
DB_NAME = os.getenv('DB_NAME', 'neondb')

def test_connection():
    """Testa la connessione al database."""
    print("[*] Test connessione al database...")
    
    try:
        if DATABASE_URL:
            conn = psycopg2.connect(DATABASE_URL)
            print("[OK] Connesso usando DATABASE_URL")
        elif all([DB_HOST, DB_USER, DB_PASSWORD]):
            conn = psycopg2.connect(
                host=DB_HOST,
                user=DB_USER,
                password=DB_PASSWORD,
                database=DB_NAME,
                sslmode='require'
            )
            print("[OK] Connesso usando variabili separate")
        else:
            print("[ERR] Configurazione mancante: DATABASE_URL o DB_HOST/DB_USER/DB_PASSWORD")
            return None
        
        return conn
    except Exception as e:
        print(f"[ERR] Errore nella connessione: {e}")
        return None

def test_table_structure(conn):
    """Verifica la struttura della tabella voti_camera."""
    print("\n[*] Verifica struttura tabella voti_camera...")
    
    try:
        with conn.cursor() as cur:
            # Verifica se la tabella esiste
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'voti_camera'
                );
            """)
            
            exists = cur.fetchone()[0]
            
            if not exists:
                print("[ERR] La tabella voti_camera non esiste!")
                return False
            
            print("[OK] Tabella voti_camera trovata")
            
            # Ottieni la struttura della tabella
            cur.execute("""
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_schema = 'public' 
                AND table_name = 'voti_camera'
                ORDER BY ordinal_position;
            """)
            
            columns = cur.fetchall()
            print("\n[*] Colonne della tabella:")
            for col in columns:
                nullable = "NULL" if col[2] == 'YES' else "NOT NULL"
                default = f" DEFAULT {col[3]}" if col[3] else ""
                print(f"  - {col[0]}: {col[1]} {nullable}{default}")
            
            # Verifica i constraint
            cur.execute("""
                SELECT constraint_name, constraint_type
                FROM information_schema.table_constraints
                WHERE table_schema = 'public' 
                AND table_name = 'voti_camera';
            """)
            
            constraints = cur.fetchall()
            if constraints:
                print("\n[*] Constraint:")
                for constraint in constraints:
                    print(f"  - {constraint[0]}: {constraint[1]}")
            
            # Conta i record
            cur.execute("SELECT COUNT(*) FROM voti_camera;")
            count = cur.fetchone()[0]
            print(f"\n[*] Record nella tabella: {count}")
            
            return True
            
    except Exception as e:
        print(f"[ERR] Errore nella verifica: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_insert(conn):
    """Testa un inserimento di prova."""
    print("\n[*] Test inserimento di prova...")
    
    try:
        with conn.cursor() as cur:
            # Prova a inserire un record di test
            test_data = {
                'politico_nome': 'TEST_POLITICO',
                'data_votazione': '2024-01-01',
                'oggetto_voto': 'Test oggetto votazione',
                'esito_voto': 'Favorevole'
            }
            
            # Prova prima a vedere se esiste già
            cur.execute("SELECT COUNT(*) FROM voti_camera WHERE politico_nome = %s", (test_data['politico_nome'],))
            exists = cur.fetchone()[0] > 0
            
            if exists:
                print("[!] Record di test già esistente, lo elimino...")
                cur.execute("DELETE FROM voti_camera WHERE politico_nome = %s", (test_data['politico_nome'],))
            
            # Prova inserimento
            try:
                cur.execute("""
                    INSERT INTO voti_camera (politico_nome, data_votazione, oggetto_voto, esito_voto)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (politico_nome) 
                    DO UPDATE SET 
                        data_votazione = EXCLUDED.data_votazione,
                        oggetto_voto = EXCLUDED.oggetto_voto,
                        esito_voto = EXCLUDED.esito_voto
                """, (test_data['politico_nome'], test_data['data_votazione'], 
                      test_data['oggetto_voto'], test_data['esito_voto']))
                conn.commit()
                print("[OK] Inserimento riuscito con ON CONFLICT")
            except psycopg2.errors.UniqueViolation:
                conn.rollback()
                # Prova senza ON CONFLICT
                cur.execute("""
                    INSERT INTO voti_camera (politico_nome, data_votazione, oggetto_voto, esito_voto)
                    VALUES (%s, %s, %s, %s)
                """, (test_data['politico_nome'], test_data['data_votazione'], 
                      test_data['oggetto_voto'], test_data['esito_voto']))
                conn.commit()
                print("[OK] Inserimento riuscito (senza ON CONFLICT)")
            except Exception as e:
                conn.rollback()
                print(f"[!] Inserimento fallito: {e}")
                print("   Provo con UPDATE...")
                cur.execute("""
                    UPDATE voti_camera 
                    SET data_votazione = %s,
                        oggetto_voto = %s,
                        esito_voto = %s
                    WHERE politico_nome = %s
                """, (test_data['data_votazione'], test_data['oggetto_voto'], 
                      test_data['esito_voto'], test_data['politico_nome']))
                if cur.rowcount == 0:
                    cur.execute("""
                        INSERT INTO voti_camera (politico_nome, data_votazione, oggetto_voto, esito_voto)
                        VALUES (%s, %s, %s, %s)
                    """, (test_data['politico_nome'], test_data['data_votazione'], 
                          test_data['oggetto_voto'], test_data['esito_voto']))
                conn.commit()
                print("[OK] Inserimento/Update riuscito")
            
            # Verifica che il record sia stato inserito
            cur.execute("SELECT * FROM voti_camera WHERE politico_nome = %s", (test_data['politico_nome'],))
            record = cur.fetchone()
            if record:
                print(f"[OK] Record verificato: {record}")
            
            # Pulisci il record di test
            cur.execute("DELETE FROM voti_camera WHERE politico_nome = %s", (test_data['politico_nome'],))
            conn.commit()
            print("[OK] Record di test rimosso")
            
            return True
            
    except Exception as e:
        print(f"[ERR] Errore nel test inserimento: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("TEST CONNESSIONE E STRUTTURA TABELLA voti_camera")
    print("=" * 60)
    
    conn = test_connection()
    if not conn:
        sys.exit(1)
    
    try:
        if test_table_structure(conn):
            test_insert(conn)
            print("\n[OK] Tutti i test completati con successo!")
        else:
            print("\n[ERR] Test fallito: tabella non valida")
            sys.exit(1)
    finally:
        conn.close()
        print("\n[*] Connessione chiusa")

