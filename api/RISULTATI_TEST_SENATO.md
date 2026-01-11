# Risultati Test Endpoint SPARQL Senato

## ✅ Test Completato

L'endpoint SPARQL del Senato funziona correttamente, ma ha una **struttura completamente diversa** dalla Camera.

## 🔍 Scoperte Importanti

### 1. Namespace Diverso
- **Camera**: `http://dati.camera.it/ocd/`
- **Senato**: `http://dati.senato.it/osr/` ⚠️

### 2. Tipo Risorsa
- **Camera**: `ocd:Votazione`
- **Senato**: `osr:Votazione` ⚠️

### 3. Predicati Disponibili

#### Camera (limitato):
- `rdfs:label` - Descrizione
- `ocd:approvato` - 1 (Approvato) o 0 (Non Approvato)
- `ocd:rif_seduta` - Riferimento seduta

#### Senato (più completo!):
- `rdfs:label` - Descrizione (es. "Controprova")
- `osr:seduta` - Riferimento seduta
- `osr:favorevoli` - Numero voti favorevoli ✅
- `osr:contrari` - Numero voti contrari ✅
- `osr:presenti` - Numero presenti
- `osr:votanti` - Numero votanti
- `osr:maggioranza` - Maggioranza richiesta
- `osr:tipoVotazione` - Tipo (es. "controprova")
- `osr:congedoMissione` - Numero in missione
- **`osr:favorevole`** - URI dei senatori che hanno votato favorevole ✅✅✅
- **`osr:contrario`** - Probabilmente esiste per i contrari

### 4. Voti Individuali Disponibili! 🎉

**IMPORTANTE**: Il Senato espone i voti individuali dei senatori tramite:
- `osr:favorevole` → URI del senatore (es. `http://dati.senato.it/senatore/3923`)
- Probabilmente anche `osr:contrario` e `osr:astenuto`

Questo è un **grande vantaggio** rispetto alla Camera che non espone i voti individuali!

## 📊 Esempio Votazione Senato

```
URI: http://dati.senato.it/votazione/13-1049-1
Tipo: http://dati.senato.it/osr/Votazione
Label: "Controprova"
Favorevoli: 32
Contrari: 67
Presenti: 101
Votanti: 100
Maggioranza: 51
Tipo Votazione: "controprova"
Seduta: http://dati.senato.it/sedutaassemblea/2893
```

## ✅ Query SPARQL Aggiornata

La query è stata aggiornata in `routes/voti-politici.js` per:
1. Usare il namespace corretto (`osr:` invece di `ocd:`)
2. Usare il tipo corretto (`osr:Votazione`)
3. Recuperare i predicati disponibili (favorevoli, contrari, etc.)
4. Calcolare l'esito confrontando favorevoli vs contrari

## 🚀 Prossimi Passi

### 1. Recuperare Voti Individuali
Il Senato espone i voti individuali! Possiamo:
- Recuperare tutti i senatori che hanno votato favorevole
- Recuperare tutti i senatori che hanno votato contrario
- Collegare questi dati con la tabella `users` per nome/cognome

### 2. Query per Voti Individuali
```sparql
PREFIX osr: <http://dati.senato.it/osr/>

SELECT ?votazione ?senatore ?tipoVoto
WHERE {
  ?votazione a osr:Votazione .
  ?votazione osr:favorevole ?senatore .
  BIND("Favorevole" AS ?tipoVoto)
}
UNION
{
  ?votazione a osr:Votazione .
  ?votazione osr:contrario ?senatore .
  BIND("Contrario" AS ?tipoVoto)
}
```

### 3. Collegare con Tabella Users
Una volta recuperati gli URI dei senatori, possiamo:
- Cercare il nome/cognome del senatore tramite SPARQL
- Oppure usare l'URI per match con `users.url_openpolis` o simili

## 📝 Note

- La struttura del Senato è più completa della Camera
- I voti individuali sono disponibili (grande vantaggio!)
- Potrebbe essere necessario adattare la logica per gestire entrambe le strutture
- Il formato URI è diverso: `http://dati.senato.it/votazione/13-1049-1` vs `http://dati.camera.it/ocd/votazione.rdf/vs19_590_001`
