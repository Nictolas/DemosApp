# Istruzioni per la Tabella voti_camera

## Struttura SQL

Esegui il file `create-voti-camera-table.sql` nel database per creare la tabella con la struttura corretta.

## Colonne della Tabella

- **politico_nome**: Nome completo del politico (UNIQUE)
- **camera**: "Camera" o "Senato" (in base a grado_elezione)
- **url_openpolis**: URL della pagina Openpolis (modificabile dall'admin)
- **votazione**: Titolo/descrizione della votazione più recente
- **voto**: "In missione", "Astenuto", "Favorevole" o "Contrario"
- **data_votazione**: Data della votazione (se disponibile)
- **ultimo_aggiornamento**: Timestamp dell'ultimo aggiornamento (auto)

## Come Popolare la Tabella

### Opzione 1: File JSON

1. Crea un file JSON con la lista dei politici e i loro URL Openpolis
2. Esegui: `node sync-voti-openpolis.js deputati.json`

### Opzione 2: Database

1. Inserisci manualmente i politici nel database con i loro URL:
```sql
INSERT INTO voti_camera (politico_nome, camera, url_openpolis)
VALUES 
  ('Giorgia Meloni', 'Camera', 'https://parlamento19.openpolis.it/persone/giorgia-meloni-1977-01-15'),
  ('Matteo Salvini', 'Camera', 'https://parlamento19.openpolis.it/persone/matteo-salvini-1973-03-09');
```

2. Esegui: `node sync-voti-openpolis.js` (recupera automaticamente dal database)

## Sincronizzazione

### Da Frontend (Admin)
- Vai su https://www.demos.community/voti-politici
- Clicca su "Sincronizza" (solo per admin)

### Da Backend
```bash
node sync-voti-openpolis.js
```

## Modifica URL (Admin)

Gli admin possono modificare l'URL di un politico direttamente dalla pagina:
1. Clicca sull'icona di modifica accanto all'URL
2. Inserisci il nuovo URL
3. Salva

## Filtri

La tabella mostra solo politici con:
- `ruolo = "P"` (Parlamentare)
- `grado_elezione = "C"` (Camera) o `"S"` (Senato)

## Note

- Lo script fa scraping dalla sezione "Votazione" della pagina Openpolis
- Prende solo la PRIMA votazione (la più recente)
- Normalizza i voti in: In missione, Astenuto, Favorevole, Contrario
- Aggiorna automaticamente `ultimo_aggiornamento` ad ogni sincronizzazione

