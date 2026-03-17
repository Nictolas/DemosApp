# Limiti dei Dati SPARQL - Votazioni Parlamento

## 📊 Situazione Attuale

Gli endpoint SPARQL ufficiali di Camera e Senato forniscono **solo dati tecnici** sulle votazioni:

### ✅ Dati Disponibili da SPARQL

**Senato:**
- ✅ Favorevoli, contrari, astenuti
- ✅ Presenti, votanti, maggioranza
- ✅ Tipo votazione (elettronica, controprova, ecc.)
- ✅ Data seduta
- ✅ Numero seduta
- ✅ Legislatura
- ✅ Presidente
- ✅ Numero legale
- ✅ Esito (Approvato/Non Approvato)
- ❌ **NON** fornisce: nome del disegno di legge, numero atto, descrizione completa

**Camera:**
- ✅ Approvato (1/0)
- ✅ Label base (spesso solo "Votazione" o "Articolo X")
- ✅ Data seduta (quando disponibile)
- ❌ **NON** fornisce: nome del disegno di legge, numero atto, descrizione completa

### ❌ Dati NON Disponibili da SPARQL

Gli endpoint SPARQL **NON** forniscono:
- Nome completo del disegno di legge (DDL, Mozione, ecc.)
- Numero del disegno di legge
- Descrizione dettagliata del contenuto
- Collegamento diretto all'atto legislativo
- Ordini del giorno collegati

## 🔍 Perché "Articolo 3", "Articolo 2", ecc.?

Il campo `rdfs:label` nelle votazioni SPARQL contiene spesso solo riferimenti generici come:
- "Articolo 3"
- "Articolo 2"
- "Votazione finale"
- "Ordine del giorno 9/2750/178"

Questo perché gli endpoint SPARQL sono progettati per fornire dati **strutturati e tecnici** sulle votazioni, non il contesto legislativo completo.

## 💡 Soluzioni Possibili

### 1. Integrazione con Openpolis (Raccomandato)
Openpolis fornisce informazioni più complete sulle votazioni, incluso:
- Nome completo del disegno di legge
- Numero atto
- Descrizione dettagliata
- Collegamenti agli atti

**Svantaggi:**
- Richiede scraping (non c'è API ufficiale)
- Più lento e complesso
- Dipendenza da struttura HTML di Openpolis

### 2. Integrazione con Portali Ufficiali
- Camera: https://www.camera.it/leg19/
- Senato: https://www.senato.it/

**Svantaggi:**
- Richiede scraping complesso
- Struttura HTML può cambiare
- Più difficile da mantenere

### 3. Usare Dati Esistenti
Se hai già dati in altre tabelle (`voti_camera`, `votazioni_parlamento`) che contengono informazioni più complete, potremmo:
- Fare JOIN tra tabelle
- Arricchire i dati SPARQL con dati esistenti

## 📝 Stato Attuale del Sistema

Il sistema attualmente:
1. ✅ Recupera tutti i dati tecnici disponibili da SPARQL
2. ✅ Salva nella tabella `parlamento`
3. ✅ Mostra i dati disponibili nel frontend
4. ⚠️ **Limite**: Mostra solo label generiche ("Articolo X") perché SPARQL non fornisce più contesto

## 🚀 Prossimi Passi

Per migliorare i dati mostrati, possiamo:
1. **Aggiungere integrazione Openpolis** per arricchire le votazioni con contesto legislativo
2. **Usare dati esistenti** da altre tabelle se disponibili
3. **Migliorare la visualizzazione** dei dati tecnici disponibili (favorevoli, contrari, astenuti, ecc.)

## 📌 Nota Tecnica

I dati SPARQL sono **corretti e completi** per quello che forniscono. Il problema è che gli endpoint ufficiali non includono il contesto legislativo completo. Questo è un limite intrinseco degli endpoint SPARQL, non un bug del nostro sistema.
