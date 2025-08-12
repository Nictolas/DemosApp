// File: api/index.js

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { pool } = require('./config/db'); // Percorso corretto per il database
const { authenticateUser } = require('./middleware/auth'); // Percorso corretto per l'auth
const { adminAuth } = require('./firebase-config.cjs'); // Configurazione Firebase solo per autenticazione

const app = express();
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));

// =============================================
//               ROTTE UTENTI (/api/utenti)
// =============================================
const utentiRouter = express.Router();

// POST /api/utenti/register
utentiRouter.post('/register', async (req, res) => {
    const { email, password, nome, cognome, data_nascita, genere, cittadinanza, ruolo, ...altriDati } = req.body;
    if (!email || !password || !nome || !cognome || !ruolo) return res.status(400).json({ error: "Dati essenziali mancanti." });
    let newUserUid = null;
    try {
        const userRecord = await adminAuth.createUser({ email, password, displayName: `${nome} ${cognome}`, disabled: true });
        newUserUid = userRecord.uid;
        const allUserData = { id: newUserUid, email, nome, cognome, data_nascita, genere, cittadinanza, ruolo, status: 'pending', data_registrazione: new Date(), ...altriDati };
        const columns = Object.keys(allUserData).map(key => `"${key}"`).join(', ');
        const values = Object.values(allUserData);
        const valuePlaceholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const insertQuery = `INSERT INTO utenti (${columns}) VALUES (${valuePlaceholders}) RETURNING *;`;
        const dbResult = await pool.query(insertQuery, values);
        res.status(201).json(dbResult.rows[0]);
    } catch (error) {
        if (newUserUid) await adminAuth.deleteUser(newUserUid);
        console.error("Errore /register:", error);
        res.status(500).json({ error: error.message || "Errore server." });
    }
});

// GET /api/utenti/me
utentiRouter.get('/me', authenticateUser, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM utenti WHERE id = $1', [req.user.uid]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Utente non trovato." });
        res.json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: "Errore server" }); }
});

// GET /api/utenti/pending
utentiRouter.get('/pending', authenticateUser, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM utenti WHERE status = 'pending' ORDER BY data_registrazione");
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Errore server" }); }
});

// POST /api/utenti/approve
utentiRouter.post('/approve', authenticateUser, async (req, res) => {
    const { userId } = req.body;
    try {
        await pool.query("UPDATE utenti SET status = 'active' WHERE id = $1", [userId]);
        await adminAuth.updateUser(userId, { disabled: false });
        res.status(200).json({ success: true });
    } catch (error) { res.status(500).json({ error: "Errore server" }); }
});
app.use('/api/utenti', utentiRouter);


// =============================================
//               ROTTE GOVERNO (/api/governo)
// =============================================
const governoRouter = express.Router();

// GET /api/governo/voti - Recupera classifiche, voti utente e stato del blocco
governoRouter.get('/voti', authenticateUser, async (req, res) => {
  const userId = req.user.uid;

  try {
    // Query per ottenere tutti i voti
    const votiResult = await pool.query('SELECT categoria, "nomeMinistro" as nome, user_id FROM voti_ministri');
    const votiList = votiResult.rows;

    // Calcolo classifiche per ogni categoria
    const classifiche = {};
    const categorie = [...new Set(votiList.map(v => v.categoria))];
    categorie.forEach(cat => {
        const votiCat = votiList.filter(v => v.categoria === cat);
        const conteggio = {};
        votiCat.forEach(v => {
            conteggio[v.nome] = (conteggio[v.nome] || 0) + 1;
        });
        classifiche[cat] = Object.entries(conteggio)
            .map(([nome, voti]) => ({ nome, voti: Number(voti) }))
            .sort((a, b) => b.voti - a.voti);
    });

    // Filtro per i voti specifici dell'utente
    const mieiVoti = {};
    votiList
        .filter(v => v.user_id === userId)
        .forEach(v => {
            mieiVoti[v.categoria] = v.nome;
        });
    
    // Controllo dello stato del blocco settimanale
    const userResult = await pool.query('SELECT "lastGovernoEdit" FROM utenti WHERE id = $1', [userId]);
    const lastEdit = userResult.rows[0]?.lastGovernoEdit;
    
    let isBlocked = false;
    let unlockDate = null;
    if (lastEdit) {
        const now = new Date();
        const diff = now.getTime() - new Date(lastEdit).getTime();
        if (diff < (7 * 24 * 60 * 60 * 1000)) {
            isBlocked = true;
            unlockDate = new Date(new Date(lastEdit).getTime() + (7 * 24 * 60 * 60 * 1000));
        }
    }

    res.json({ 
        classifiche, 
        mieiVoti, 
        blocco: { isBlocked, unlockDate } 
    });

  } catch (error) {
    console.error("Errore GET /api/governo/voti:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// POST /api/governo/vota - Salva/Aggiorna le preferenze del governo dell'utente
governoRouter.post('/vota', authenticateUser, async (req, res) => {
    const userId = req.user.uid;
    const { voti } = req.body; // Oggetto { categoria: 'nome', ... }

    if (typeof voti !== 'object' || voti === null) {
        return res.status(400).json({ error: "Il formato dei voti non è valido." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Controllo del blocco settimanale
        const userResult = await client.query('SELECT "lastGovernoEdit" FROM utenti WHERE id = $1', [userId]);
        const lastEdit = userResult.rows[0]?.lastGovernoEdit;
        if (lastEdit) {
            const now = new Date();
            const diff = now.getTime() - new Date(lastEdit).getTime();
            if (diff < (7 * 24 * 60 * 60 * 1000)) {
                throw new Error("Puoi modificare le preferenze solo una volta a settimana.");
            }
        }
        
        // 1. Cancella tutti i voti precedenti dell'utente per il governo
        await client.query('DELETE FROM voti_ministri WHERE user_id = $1', [userId]);

        // 2. Inserisce i nuovi voti
        const votiEntries = Object.entries(voti);
        if (votiEntries.length > 0) {
            const queryValues = [];
            const queryParams = [userId];
            votiEntries.forEach(([categoria, nomeMinistro]) => {
                queryParams.push(categoria, nomeMinistro);
                queryValues.push(`($1, $${queryParams.length-1}, $${queryParams.length})`);
            });
            
            const insertQuery = `INSERT INTO voti_ministri (user_id, categoria, "nomeMinistro") VALUES ${queryValues.join(',')}`;
            await client.query(insertQuery, queryParams);
        }

        // 3. Aggiorna il timestamp dell'ultima modifica
        await client.query('UPDATE utenti SET "lastGovernoEdit" = NOW() WHERE id = $1', [userId]);

        await client.query('COMMIT');
        res.status(200).json({ success: true, message: "Preferenze salvate." });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Errore POST /api/governo/vota:", error);
        res.status(500).json({ error: error.message || "Errore del server" });
    } finally {
        client.release();
    }
});

// Aggiungi la rotta all'app principale
app.use('/api/governo', governoRouter);


// =============================================
//               ROTTE AMNISTIA
// =============================================
// File: api/amnistia.js
const amnistiaRouter = express.Router();
// GET /api/amnistia - Recupera classifica e voti utente
amnistiaRouter.get('/', authenticateUser, async (req, res) => {
  const userId = req.user.uid; 
  try {
    const classificaQuery = `
      SELECT legge, COUNT(*) as voti FROM voti_amnistia
      GROUP BY legge ORDER BY voti DESC LIMIT 10;
    `;
    const classificaResult = await pool.query(classificaQuery);
    
    const mieiVotiQuery = `SELECT legge FROM voti_amnistia WHERE user_id = $1;`;
    const mieiVotiResult = await pool.query(mieiVotiQuery, [userId]);
    
    const classifica = classificaResult.rows;
    const mieiVoti = mieiVotiResult.rows.map(row => row.legge);

    res.json({ classifica, mieiVoti });
  } catch (error) {
    console.error("Errore GET /api/amnistia:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// POST /api/amnistia/vota - Aggiunge un nuovo voto
amnistiaRouter.post('/vota', authenticateUser, async (req, res) => {
  const userId = req.user.uid;
  const { legge } = req.body;

  if (!legge || typeof legge !== 'string' || legge.trim() === '') {
    return res.status(400).json({ error: "Il nome della legge è obbligatorio." });
  }
  try {
    const insertQuery = 'INSERT INTO voti_amnistia (user_id, legge) VALUES ($1, $2) ON CONFLICT (user_id, legge) DO NOTHING';
    await pool.query(insertQuery, [userId, legge.trim()]);
    res.status(201).json({ success: true });
  } catch (error) {
    console.error("Errore POST /api/amnistia/vota:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// DELETE /api/amnistia/vota - Rimuove un voto
amnistiaRouter.delete('/vota', authenticateUser, async (req, res) => {
  const userId = req.user.uid;
  const { legge } = req.body;

  if (!legge || typeof legge !== 'string' || legge.trim() === '') {
    return res.status(400).json({ error: "Il nome della legge è obbligatorio." });
  }
  try {
    const deleteQuery = 'DELETE FROM voti_amnistia WHERE user_id = $1 AND legge = $2';
    const result = await pool.query(deleteQuery, [userId, legge.trim()]);
    
    if (result.rowCount === 0) return res.status(404).json({ error: "Voto non trovato." });
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Errore DELETE /api/amnistia/vota:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

app.use('/api/amnistia', amnistiaRouter);

// =============================================
//               CAPO DI STATO
// =============================================

// File: api/capo-stato.js
const capoStatoRouter = express.Router(); // Nome corretto


// GET /api/capo-stato - Recupera classifica, voti utente e stato del blocco
capoStatoRouter.get('/', authenticateUser, async (req, res) => {
  const userId = req.user.uid;

  try {
    // Query per la classifica generale
    const classificaQuery = `
      SELECT nome, COUNT(*) as voti
      FROM voti_capo_stato
      GROUP BY nome
      ORDER BY voti DESC
      LIMIT 10;
    `;
    const classificaResult = await pool.query(classificaQuery);

    // Query per i voti specifici dell'utente
    const mieiVotiQuery = `SELECT nome FROM voti_capo_stato WHERE user_id = $1;`;
    const mieiVotiResult = await pool.query(mieiVotiQuery, [userId]);
    
    // Query per controllare lo stato del blocco settimanale
    const bloccoQuery = `SELECT "lastCapoStatoEdit" FROM utenti WHERE id = $1;`;
    const userResult = await pool.query(bloccoQuery, [userId]);
    const lastEdit = userResult.rows[0]?.lastCapoStatoEdit;
    
    let isBlocked = false;
    let unlockDate = null;
    if (lastEdit) {
        const now = new Date();
        const lastEditDate = new Date(lastEdit);
        const diff = now.getTime() - lastEditDate.getTime();
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        if (diff < weekMs) {
            isBlocked = true;
            unlockDate = new Date(lastEditDate.getTime() + weekMs);
        }
    }

    // Formattazione dei risultati per il frontend
    const classifica = classificaResult.rows;
    const mieiVoti = mieiVotiResult.rows.map(row => row.nome);

    res.json({ 
        classifica, 
        mieiVoti, 
        blocco: { isBlocked, unlockDate } 
    });

  } catch (error) {
    console.error("Errore GET /api/capo-stato:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// POST /api/capo-stato/vota - Salva/Aggiorna i voti dell'utente
capoStatoRouter.post('/vota', authenticateUser, async (req, res) => {
    const userId = req.user.uid;
    const { voti } = req.body; // Array di nomi votati

    if (!Array.isArray(voti)) {
        return res.status(400).json({ error: "Il formato dei voti non è valido." });
    }

    // Inizia una transazione per assicurare che tutte le operazioni vengano eseguite o nessuna
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Controlla il blocco settimanale prima di procedere
        const userResult = await client.query('SELECT "lastCapoStatoEdit" FROM utenti WHERE id = $1;', [userId]);
        const lastEdit = userResult.rows[0]?.lastCapoStatoEdit;
        if (lastEdit) {
            const now = new Date();
            const diff = now.getTime() - new Date(lastEdit).getTime();
            if (diff < (7 * 24 * 60 * 60 * 1000)) {
                throw new Error("Puoi modificare i voti solo una volta a settimana.");
            }
        }
        
        // 1. Cancella tutti i voti precedenti dell'utente per questa categoria
        await client.query('DELETE FROM voti_capo_stato WHERE user_id = $1', [userId]);

        // 2. Inserisce i nuovi voti
        if (voti.length > 0) {
            const insertQuery = 'INSERT INTO voti_capo_stato (user_id, nome) VALUES ' + 
                                voti.map((_, i) => `($1, $${i + 2})`).join(',');
            await client.query(insertQuery, [userId, ...voti]);
        }

        // 3. Aggiorna il timestamp dell'ultima modifica
        await client.query('UPDATE utenti SET "lastCapoStatoEdit" = NOW() WHERE id = $1', [userId]);

        await client.query('COMMIT');
        res.status(200).json({ success: true, message: "Voti salvati con successo." });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Errore POST /api/capo-stato/vota:", error);
        res.status(500).json({ error: error.message || "Errore del server" });
    } finally {
        client.release();
    }
});

app.use('/api/capo-stato', capoStatoRouter);





// =============================================
//               ELEZIONI
// =============================================



// File: api/elezioni.js
const elezioniRouter = express.Router();

// GET /api/elezioni - Recupera tutte le elezioni
elezioniRouter.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM elezioni ORDER BY "dataInizio" DESC');
    res.json(result.rows);
  } catch (error) {
    console.error("Errore GET /api/elezioni:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// POST /api/elezioni - Crea una nuova elezione
elezioniRouter.post('/', authenticateUser, async (req, res) => {
  // Aggiungi un controllo per assicurarti che solo un Admin possa creare
  // if (req.user.role !== 'Admin') return res.status(403).json({ error: "Accesso negato" });

  const { tipo, zona, dataInizio, dataFine, circa } = req.body;
  if (!tipo || !zona || !dataInizio || !dataFine) {
    return res.status(400).json({ error: "Tutti i campi sono obbligatori." });
  }

  try {
    const query = `
      INSERT INTO elezioni (tipo, zona, "dataInizio", "dataFine", circa)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await pool.query(query, [tipo, zona, dataInizio, dataFine, circa]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Errore POST /api/elezioni:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// PUT /api/elezioni/:id - Modifica un'elezione esistente
elezioniRouter.put('/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  const { tipo, zona, dataInizio, dataFine, circa } = req.body;
  if (!tipo || !zona || !dataInizio || !dataFine) {
    return res.status(400).json({ error: "Tutti i campi sono obbligatori." });
  }
  try {
    const query = `
      UPDATE elezioni
      SET tipo = $1, zona = $2, "dataInizio" = $3, "dataFine" = $4, circa = $5
      WHERE id = $6
      RETURNING *;
    `;
    const result = await pool.query(query, [tipo, zona, dataInizio, dataFine, circa, id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Elezione non trovata." });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(`Errore PUT /api/elezioni/${id}:`, error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// DELETE /api/elezioni/:id - Elimina un'elezione
elezioniRouter.delete('/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM elezioni WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Elezione non trovata." });
    res.status(204).send(); // 204 No Content
  } catch (error) {
    console.error(`Errore DELETE /api/elezioni/${id}:`, error);
    res.status(500).json({ error: "Errore del server" });
  }
});

app.use('/api/elezioni', elezioniRouter);


// =============================================
//               MINISTERI
// =============================================

const ministeriRouter = express.Router();

// GET /api/ministeri - Recupera tutti i ministeri
ministeriRouter.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ministeri ORDER BY nome ASC');
    res.json(result.rows);
  } catch (error) {
    console.error("Errore GET /api/ministeri:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// POST /api/ministeri - Aggiunge un nuovo ministero
ministeriRouter.post('/', authenticateUser, async (req, res) => {
    // Qui andrebbe un controllo per assicurarsi che solo un Admin possa aggiungere
    const { nome, categoria, descrizione } = req.body;
    if (!nome || !categoria) {
        return res.status(400).json({ error: "Nome e categoria sono obbligatori." });
    }
    try {
        const query = 'INSERT INTO ministeri (nome, categoria, descrizione) VALUES ($1, $2, $3) RETURNING *';
        const result = await pool.query(query, [nome, categoria, descrizione || null]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Errore POST /api/ministeri:", error);
        res.status(500).json({ error: "Errore del server" });
    }
});

// PUT /api/ministeri/:id - Modifica un ministero
ministeriRouter.put('/:id', authenticateUser, async (req, res) => {
    const { id } = req.params;
    const { nome, categoria, descrizione } = req.body;
    if (!nome || !categoria) {
        return res.status(400).json({ error: "Nome e categoria sono obbligatori." });
    }
    try {
        const query = 'UPDATE ministeri SET nome = $1, categoria = $2, descrizione = $3 WHERE id = $4 RETURNING *';
        const result = await pool.query(query, [nome, categoria, descrizione || null, id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Ministero non trovato." });
        res.json(result.rows[0]);
    } catch (error) {
        console.error(`Errore PUT /api/ministeri/${id}:`, error);
        res.status(500).json({ error: "Errore del server" });
    }
});

// DELETE /api/ministeri/:id - Elimina un ministero
ministeriRouter.delete('/:id', authenticateUser, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM ministeri WHERE id = $1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Ministero non trovato." });
        res.status(204).send(); // Successo, nessun contenuto
    } catch (error) {
        console.error(`Errore DELETE /api/ministeri/${id}:`, error);
        res.status(500).json({ error: "Errore del server" });
    }
});

app.use('/api/ministeri', ministeriRouter);

// =============================================
//               STATISTICHE
// =============================================

// File: api/statistiche.js
const statisticheRouter = express.Router();

// GET /api/statistiche/utenti - Calcola e restituisce le statistiche aggregate sugli utenti
statisticheRouter.get('/utenti', authenticateUser, async (req, res) => {
    // Aggiungi un controllo per assicurarti che solo un Admin possa accedere
    // const userRoleResult = await pool.query('SELECT ruolo FROM utenti WHERE id = $1', [req.user.uid]);
    // if (userRoleResult.rows[0]?.ruolo !== 'Admin') {
    //     return res.status(403).json({ error: "Accesso negato." });
    // }

    try {
        // Eseguiamo più query in parallelo per efficienza
        const [
            totalUsersResult,
            usersByRoleResult,
            usersByGenderResult,
            usersByCitizenshipResult,
            usersByRegionResult,
            usersByCityResult
        ] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM utenti'),
            pool.query('SELECT ruolo, COUNT(*) FROM utenti WHERE ruolo IS NOT NULL GROUP BY ruolo'),
            pool.query('SELECT genere, COUNT(*) FROM utenti WHERE genere IS NOT NULL GROUP BY genere'),
            pool.query('SELECT cittadinanza, COUNT(*) FROM utenti WHERE cittadinanza IS NOT NULL GROUP BY cittadinanza'),
            pool.query('SELECT regione_residenza, COUNT(*) FROM utenti WHERE regione_residenza IS NOT NULL GROUP BY regione_residenza'),
            pool.query('SELECT comune_residenza, COUNT(*) FROM utenti WHERE comune_residenza IS NOT NULL GROUP BY comune_residenza')
        ]);

        // Funzione helper per trasformare l'array di risultati in un oggetto
        const arrayToObject = (rows, keyField, valueField) => {
            return rows.reduce((acc, row) => {
                acc[row[keyField]] = parseInt(row[valueField], 10);
                return acc;
            }, {});
        };

        const stats = {
            totalUsers: parseInt(totalUsersResult.rows[0].count, 10),
            usersByRole: arrayToObject(usersByRoleResult.rows, 'ruolo', 'count'),
            usersByGender: arrayToObject(usersByGenderResult.rows, 'genere', 'count'),
            usersByCitizenship: arrayToObject(usersByCitizenshipResult.rows, 'cittadinanza', 'count'),
            usersByRegion: arrayToObject(usersByRegionResult.rows, 'regione_residenza', 'count'),
            usersByCity: arrayToObject(usersByCityResult.rows, 'comune_residenza', 'count')
        };

        res.json(stats);

    } catch (error) {
        console.error("Errore GET /api/statistiche/utenti:", error);
        res.status(500).json({ error: "Errore del server" });
    }
});

app.use('/api/statistiche', statisticheRouter);


// =============================================
//               REFERENDUM
// =============================================


// File: api/referendum-abrogativi.js
const referendumRouter = express.Router();

// GET /api/referendum-abrogativi - Recupera tutti i referendum approvati
referendumRouter.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM referendum_abrogativi WHERE stato = $1 ORDER BY "dataInizio" DESC', ['accepted']);
    res.json(result.rows);
  } catch (error) {
    console.error("Errore GET /api/referendum-abrogativi:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// GET /api/referendum-abrogativi/richieste - Recupera i referendum in attesa (solo Admin)
referendumRouter.get('/richieste', authenticateUser, async (req, res) => {
    // if (req.user.role !== 'Admin') return res.status(403).json({ error: "Accesso negato" });
    try {
        const result = await pool.query('SELECT * FROM referendum_abrogativi WHERE stato = $1 ORDER BY timestamp DESC', ['pending']);
        res.json(result.rows);
    } catch (error) {
        console.error("Errore GET /api/referendum-abrogativi/richieste:", error);
        res.status(500).json({ error: "Errore del server" });
    }
});

// POST /api/referendum-abrogativi - Propone un nuovo referendum (stato 'pending')
referendumRouter.post('/', authenticateUser, async (req, res) => {
  const userId = req.user.uid;
  const { nome, descrizione, dataInizio, dataFine, sitoWeb } = req.body;

  if (!nome || !descrizione || !dataInizio || !dataFine) {
    return res.status(400).json({ error: "Tutti i campi obbligatori devono essere forniti." });
  }

  try {
    const query = `
      INSERT INTO referendum_abrogativi (user_id, nome, descrizione, "dataInizio", "dataFine", "sitoWeb", stato, quorum)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'pending')
      RETURNING *;
    `;
    const result = await pool.query(query, [userId, nome, descrizione, dataInizio, dataFine, sitoWeb || null]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Errore POST /api/referendum-abrogativi:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// POST /api/referendum-abrogativi/:id/accetta - Approva un referendum (solo Admin)
referendumRouter.post('/:id/accetta', authenticateUser, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('UPDATE referendum_abrogativi SET stato = $1 WHERE id = $2 RETURNING *', ['accepted', id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Richiesta non trovata." });
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(`Errore POST /api/referendum-abrogativi/${id}/accetta:`, error);
        res.status(500).json({ error: "Errore del server" });
    }
});

// POST /api/referendum-abrogativi/:id/rifiuta - Rifiuta un referendum (solo Admin)
referendumRouter.post('/:id/rifiuta', authenticateUser, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('UPDATE referendum_abrogativi SET stato = $1 WHERE id = $2 RETURNING *', ['rejected', id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Richiesta non trovata." });
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(`Errore POST /api/referendum-abrogativi/${id}/rifiuta:`, error);
        res.status(500).json({ error: "Errore del server" });
    }
});

// PATCH /api/referendum-abrogativi/:id/quorum - Aggiorna lo stato del quorum (solo Admin)
referendumRouter.patch('/:id/quorum', authenticateUser, async (req, res) => {
    // if (req.user.role !== 'Admin') return res.status(403).json({ error: "Accesso negato" });
    const { id } = req.params;
    const { quorum } = req.body;
    if (!['ok', 'pending', 'no'].includes(quorum)) {
        return res.status(400).json({ error: "Valore di quorum non valido." });
    }
    try {
        const result = await pool.query('UPDATE referendum_abrogativi SET quorum = $1 WHERE id = $2 RETURNING *', [quorum, id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Referendum non trovato." });
        res.json(result.rows[0]);
    } catch (error) {
        console.error(`Errore PATCH /api/referendum-abrogativi/${id}/quorum:`, error);
        res.status(500).json({ error: "Errore del server" });
    }
});

// DELETE /api/referendum-abrogativi/:id - Elimina un referendum (solo Admin)
referendumRouter.delete('/:id', authenticateUser, async (req, res) => {
  // if (req.user.role !== 'Admin') return res.status(403).json({ error: "Accesso negato" });
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM referendum_abrogativi WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Referendum non trovato." });
    res.status(204).send();
  } catch (error) {
    console.error(`Errore DELETE /api/referendum-abrogativi/${id}:`, error);
    res.status(500).json({ error: "Errore del server" });
  }
});

app.use('/api/referendum-abrogativi', referendumRouter);


// =============================================
//               SONDAGGI
// =============================================

// File: api/sondaggi.js
const sondaggiRouter = express.Router();

// GET /api/sondaggi/stats - Calcola e restituisce le statistiche aggregate
sondaggiRouter.get('/stats', authenticateUser, async (req, res) => {
    // Aggiungi un controllo per assicurarti che solo un Admin possa accedere
    // const userRoleResult = await pool.query('SELECT ruolo FROM utenti WHERE id = $1', [req.user.uid]);
    // if (userRoleResult.rows[0]?.ruolo !== 'Admin') {
    //     return res.status(403).json({ error: "Accesso negato." });
    // }

    const client = await pool.connect();
    try {
        // 1. Recupera la lista di tutte le domande/opinioni disponibili
        const questionsResult = await client.query('SELECT id, text FROM opinioni ORDER BY text ASC');
        const questions = questionsResult.rows;

        if (questions.length === 0) {
            return res.json({ stats: {}, questions: [] });
        }
        
        // 2. Costruisci dinamicamente la query SQL per contare i voti per ogni opinione
        const questionIds = questions.map(q => q.id);

        // Prepara una serie di sub-query per ogni domanda
        const selectClauses = questionIds.map(id => `
            COUNT(CASE WHEN "${id}" = 'Favorevole' THEN 1 END) AS "${id}_favorevole",
            COUNT(CASE WHEN "${id}" = 'Contrario' THEN 1 END) AS "${id}_contrario",
            COUNT(CASE WHEN "${id}" = 'Indeciso' THEN 1 END) AS "${id}_astenuto"
        `).join(', ');

        const statsQuery = `SELECT ${selectClauses} FROM utenti`;
        
        const statsResult = await client.query(statsQuery);
        const rawStats = statsResult.rows[0];

        // 3. Formatta i dati per il frontend
        const formattedStats = {};
        questionIds.forEach(id => {
            formattedStats[id] = {
                favorevole: parseInt(rawStats[`${id}_favorevole`], 10) || 0,
                contrario: parseInt(rawStats[`${id}_contrario`], 10) || 0,
                astenuto: parseInt(rawStats[`${id}_astenuto`], 10) || 0,
            };
        });

        res.json({ stats: formattedStats, questions });

    } catch (error) {
        console.error("Errore GET /api/sondaggi/stats:", error);
        res.status(500).json({ error: "Errore del server" });
    } finally {
        client.release();
    }
});

app.use('/api/sondaggi', sondaggiRouter);


// =============================================
//             PROGRAMMA
// =============================================


// File: api/programma.js
const programmaRouter = express.Router();


// GET /api/programma - Recupera il programma dell'utente loggato
programmaRouter.get('/', authenticateUser, async (req, res) => {
  const userId = req.user.uid;

  try {
    // Recupera sia i dati utente che il programma in una sola richiesta per efficienza
    const userQuery = 'SELECT id, ruolo FROM utenti WHERE id = $1';
    const programmaQuery = 'SELECT * FROM programmi WHERE user_id = $1';

    const [userResult, programmaResult] = await Promise.all([
        pool.query(userQuery, [userId]),
        pool.query(programmaQuery, [userId])
    ]);
    
    const user = userResult.rows[0];
    const programma = programmaResult.rows[0] || {}; // Restituisce un oggetto vuoto se non c'è programma

    // Rimuove user_id dal programma per non essere ridondante
    delete programma.user_id;

    res.json({ user, programma });

  } catch (error) {
    console.error("Errore GET /api/programma:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// POST /api/programma - Crea o aggiorna il programma dell'utente loggato
programmaRouter.post('/', authenticateUser, async (req, res) => {
    const userId = req.user.uid;
    const { proposta1, proposta2, proposta3, proposta4, proposta5 } = req.body;
  
    // Controllo di autorizzazione: solo certi ruoli possono scrivere un programma
    const userRoleResult = await pool.query('SELECT ruolo FROM utenti WHERE id = $1', [userId]);
    const userRole = userRoleResult.rows[0]?.ruolo;
    if (!["Admin", "Candidato", "Candidato Politico"].includes(userRole)) {
        return res.status(403).json({ error: "Accesso negato: ruolo non autorizzato." });
    }

    try {
        const query = `
            INSERT INTO programmi (user_id, proposta1, proposta2, proposta3, proposta4, proposta5)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (user_id) DO UPDATE SET
                proposta1 = EXCLUDED.proposta1,
                proposta2 = EXCLUDED.proposta2,
                proposta3 = EXCLUDED.proposta3,
                proposta4 = EXCLUDED.proposta4,
                proposta5 = EXCLUDED.proposta5
            RETURNING *;
        `;
        const result = await pool.query(query, [userId, proposta1, proposta2, proposta3, proposta4, proposta5]);
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Errore POST /api/programma:", error);
        res.status(500).json({ error: "Errore del server durante il salvataggio del programma." });
    }
});

app.use('/api/programma', programmaRouter);



// =============================================
//              ICE
// =============================================


// File: api/ice.js
const iceRouter = express.Router();

// GET /api/ice - Recupera tutte le ICE approvate
iceRouter.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ice WHERE stato = $1 ORDER BY "dataInizio" DESC', ['accepted']);
    res.json(result.rows);
  } catch (error) {
    console.error("Errore GET /api/ice:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// GET /api/ice/richieste - Recupera le ICE in attesa di approvazione (solo per Admin)
iceRouter.get('/richieste', authenticateUser, async (req, res) => {
    // if (req.user.role !== 'Admin') return res.status(403).json({ error: "Accesso negato" });
    try {
        const result = await pool.query('SELECT * FROM ice WHERE stato = $1 ORDER BY timestamp DESC', ['pending']);
        res.json(result.rows);
    } catch (error) {
        console.error("Errore GET /api/ice/richieste:", error);
        res.status(500).json({ error: "Errore del server" });
    }
});


// POST /api/ice - Propone una nuova ICE (stato 'pending')
iceRouter.post('/', authenticateUser, async (req, res) => {
  const userId = req.user.uid;
  const { nome, descrizione, dataInizio, dataFine, sitoWeb } = req.body;

  if (!nome || !descrizione || !dataInizio || !dataFine) {
    return res.status(400).json({ error: "Tutti i campi obbligatori devono essere forniti." });
  }

  try {
    const query = `
      INSERT INTO ice (user_id, nome, descrizione, "dataInizio", "dataFine", "sitoWeb", stato, quorum)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'pending')
      RETURNING *;
    `;
    const result = await pool.query(query, [userId, nome, descrizione, dataInizio, dataFine, sitoWeb || null]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Errore POST /api/ice:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// POST /api/ice/:id/accetta - Approva una ICE (solo Admin)
iceRouter.post('/:id/accetta', authenticateUser, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('UPDATE ice SET stato = $1 WHERE id = $2 RETURNING *', ['accepted', id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Richiesta non trovata." });
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(`Errore POST /api/ice/${id}/accetta:`, error);
        res.status(500).json({ error: "Errore del server" });
    }
});

// POST /api/ice/:id/rifiuta - Rifiuta una ICE (solo Admin)
iceRouter.post('/:id/rifiuta', authenticateUser, async (req, res) => {
    const { id } = req.params;
    try {
        // Invece di cancellare, potremmo voler marcare come 'rejected'
        const result = await pool.query('UPDATE ice SET stato = $1 WHERE id = $2 RETURNING *', ['rejected', id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Richiesta non trovata." });
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(`Errore POST /api/ice/${id}/rifiuta:`, error);
        res.status(500).json({ error: "Errore del server" });
    }
});


// PATCH /api/ice/:id/quorum - Aggiorna lo stato del quorum (solo Admin)
iceRouter.patch('/:id/quorum', authenticateUser, async (req, res) => {
    // if (req.user.role !== 'Admin') return res.status(403).json({ error: "Accesso negato" });
    const { id } = req.params;
    const { quorum } = req.body;
    if (!['ok', 'pending', 'no'].includes(quorum)) {
        return res.status(400).json({ error: "Valore di quorum non valido." });
    }
    try {
        const result = await pool.query('UPDATE ice SET quorum = $1 WHERE id = $2 RETURNING *', [quorum, id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "ICE non trovata." });
        res.json(result.rows[0]);
    } catch (error) {
        console.error(`Errore PATCH /api/ice/${id}/quorum:`, error);
        res.status(500).json({ error: "Errore del server" });
    }
});


// DELETE /api/ice/:id - Elimina una ICE (solo Admin)
iceRouter.delete('/:id', authenticateUser, async (req, res) => {
  // if (req.user.role !== 'Admin') return res.status(403).json({ error: "Accesso negato" });
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM ice WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "ICE non trovata." });
    res.status(204).send();
  } catch (error) {
    console.error(`Errore DELETE /api/ice/${id}:`, error);
    res.status(500).json({ error: "Errore del server" });
  }
});

app.use('/api/ice', iceRouter);

// =============================================
//              GRAZIA
// =============================================

// File: api/grazia.js
const graziaRouter = express.Router();

// GET /api/grazia - Recupera classifica, voti utente e stato del blocco
graziaRouter.get('/', authenticateUser, async (req, res) => {
  const userId = req.user.uid;

  try {
    // Query per la classifica generale
    const classificaQuery = `
      SELECT nome, COUNT(*) as voti
      FROM voti_grazia
      GROUP BY nome
      ORDER BY voti DESC
      LIMIT 10;
    `;
    const classificaResult = await pool.query(classificaQuery);

    // Query per i voti specifici dell'utente
    const mieiVotiQuery = `SELECT nome FROM voti_grazia WHERE user_id = $1;`;
    const mieiVotiResult = await pool.query(mieiVotiQuery, [userId]);
    
    // Query per controllare lo stato del blocco settimanale
    const bloccoQuery = `SELECT "lastGraziaEdit" FROM utenti WHERE id = $1;`;
    const userResult = await pool.query(bloccoQuery, [userId]);
    const lastEdit = userResult.rows[0]?.lastGraziaEdit;
    
    let isBlocked = false;
    let unlockDate = null;
    if (lastEdit) {
        const now = new Date();
        const lastEditDate = new Date(lastEdit);
        const diff = now.getTime() - lastEditDate.getTime();
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        if (diff < weekMs) {
            isBlocked = true;
            unlockDate = new Date(lastEditDate.getTime() + weekMs);
        }
    }

    // Formattazione dei risultati
    const classifica = classificaResult.rows;
    const mieiVoti = mieiVotiResult.rows.map(row => row.nome);

    res.json({ 
        classifica, 
        mieiVoti, 
        blocco: { isBlocked, unlockDate } 
    });

  } catch (error) {
    console.error("Errore GET /api/grazia:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// POST /api/grazia/vota - Salva/Aggiorna le richieste di grazia dell'utente
router.post('/vota', authenticateUser, async (req, res) => {
    const userId = req.user.uid;
    const { voti } = req.body; // Array di nomi per cui si chiede la grazia

    if (!Array.isArray(voti)) {
        return res.status(400).json({ error: "Il formato dei voti non è valido." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Controlla il blocco settimanale
        const userResult = await client.query('SELECT "lastGraziaEdit" FROM utenti WHERE id = $1;', [userId]);
        const lastEdit = userResult.rows[0]?.lastGraziaEdit;
        if (lastEdit) {
            const now = new Date();
            const diff = now.getTime() - new Date(lastEdit).getTime();
            if (diff < (7 * 24 * 60 * 60 * 1000)) {
                throw new Error("Puoi modificare le richieste solo una volta a settimana.");
            }
        }
        
        // 1. Cancella tutte le richieste di grazia precedenti dell'utente
        await client.query('DELETE FROM voti_grazia WHERE user_id = $1', [userId]);

        // 2. Inserisce le nuove richieste
        if (voti.length > 0) {
            const insertQuery = 'INSERT INTO voti_grazia (user_id, nome) VALUES ' + 
                                voti.map((_, i) => `($1, $${i + 2})`).join(',');
            await client.query(insertQuery, [userId, ...voti]);
        }

        // 3. Aggiorna il timestamp dell'ultima modifica
        await client.query('UPDATE utenti SET "lastGraziaEdit" = NOW() WHERE id = $1', [userId]);

        await client.query('COMMIT');
        res.status(200).json({ success: true, message: "Richieste di grazia salvate." });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Errore POST /api/grazia/vota:", error);
        res.status(500).json({ error: error.message || "Errore del server" });
    } finally {
        client.release();
    }
});

app.use('/api/grazia', graziaRouter);


// =============================================
//              INIZIATIVE
// =============================================


// File: api/iniziative-popolari.js


// GET /api/iniziative-popolari - Recupera tutte le iniziative approvate
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM iniziative_popolari WHERE stato = $1 ORDER BY "dataInizio" DESC', ['accepted']);
    res.json(result.rows);
  } catch (error) {
    console.error("Errore GET /api/iniziative-popolari:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// GET /api/iniziative-popolari/richieste - Recupera le iniziative in attesa (solo Admin)
router.get('/richieste', authenticateUser, async (req, res) => {
    // if (req.user.role !== 'Admin') return res.status(403).json({ error: "Accesso negato" });
    try {
        const result = await pool.query('SELECT * FROM iniziative_popolari WHERE stato = $1 ORDER BY timestamp DESC', ['pending']);
        res.json(result.rows);
    } catch (error) {
        console.error("Errore GET /api/iniziative-popolari/richieste:", error);
        res.status(500).json({ error: "Errore del server" });
    }
});


// POST /api/iniziative-popolari - Propone una nuova iniziativa (stato 'pending')
router.post('/', authenticateUser, async (req, res) => {
  const userId = req.user.uid;
  const { nome, descrizione, dataInizio, dataFine, sitoWeb } = req.body;

  if (!nome || !descrizione || !dataInizio || !dataFine) {
    return res.status(400).json({ error: "Tutti i campi obbligatori devono essere forniti." });
  }

  try {
    const query = `
      INSERT INTO iniziative_popolari (user_id, nome, descrizione, "dataInizio", "dataFine", "sitoWeb", stato, quorum)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'pending')
      RETURNING *;
    `;
    const result = await pool.query(query, [userId, nome, descrizione, dataInizio, dataFine, sitoWeb || null]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Errore POST /api/iniziative-popolari:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// POST /api/iniziative-popolari/:id/accetta - Approva un'iniziativa (solo Admin)
router.post('/:id/accetta', authenticateUser, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('UPDATE iniziative_popolari SET stato = $1 WHERE id = $2 RETURNING *', ['accepted', id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Richiesta non trovata." });
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(`Errore POST /api/iniziative-popolari/${id}/accetta:`, error);
        res.status(500).json({ error: "Errore del server" });
    }
});

// POST /api/iniziative-popolari/:id/rifiuta - Rifiuta un'iniziativa (solo Admin)
router.post('/:id/rifiuta', authenticateUser, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('UPDATE iniziative_popolari SET stato = $1 WHERE id = $2 RETURNING *', ['rejected', id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Richiesta non trovata." });
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(`Errore POST /api/iniziative-popolari/${id}/rifiuta:`, error);
        res.status(500).json({ error: "Errore del server" });
    }
});

// PATCH /api/iniziative-popolari/:id/quorum - Aggiorna lo stato del quorum (solo Admin)
router.patch('/:id/quorum', authenticateUser, async (req, res) => {
    // if (req.user.role !== 'Admin') return res.status(403).json({ error: "Accesso negato" });
    const { id } = req.params;
    const { quorum } = req.body;
    if (!['ok', 'pending', 'no'].includes(quorum)) {
        return res.status(400).json({ error: "Valore di quorum non valido." });
    }
    try {
        const result = await pool.query('UPDATE iniziative_popolari SET quorum = $1 WHERE id = $2 RETURNING *', [quorum, id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Iniziativa non trovata." });
        res.json(result.rows[0]);
    } catch (error) {
        console.error(`Errore PATCH /api/iniziative-popolari/${id}/quorum:`, error);
        res.status(500).json({ error: "Errore del server" });
    }
});

// DELETE /api/iniziative-popolari/:id - Elimina un'iniziativa (solo Admin)
router.delete('/:id', authenticateUser, async (req, res) => {
  // if (req.user.role !== 'Admin') return res.status(403).json({ error: "Accesso negato" });
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM iniziative_popolari WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Iniziativa non trovata." });
    res.status(204).send();
  } catch (error) {
    console.error(`Errore DELETE /api/iniziative-popolari/${id}:`, error);
    res.status(500).json({ error: "Errore del server" });
  }
});

app.use('/api/iniziative-popolari', iniziativePopolariRouter);




// =============================================
//             COMUNICAZIONI
// =============================================




// File: api/notifiche.js


// GET /api/notifiche - Recupera i dati per la pagina notifiche
router.get('/', authenticateUser, async (req, res) => {
    const userId = req.user.uid;

    try {
        // 1. Recupera i dati dell'utente, inclusi i suoi rappresentanti e le preferenze
        const userResult = await pool.query('SELECT * FROM utenti WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) return res.status(404).json({ error: "Utente non trovato." });
        
        const userData = userResult.rows[0];
        const rappresentantiSeguiti = [
            userData.rappresentante_europeo,
            userData.rappresentante_camera,
            userData.rappresentante_senato,
            userData.rappresentante_regionale,
            userData.rappresentante_comunale,
        ].filter(Boolean); // Rimuove eventuali valori null o undefined

        if (rappresentantiSeguiti.length === 0) {
            return res.json({
                comunicazioni: [],
                rappresentantiInfo: {},
                preferenze: userData.notifiche_preferenze || {}
            });
        }

        // 2. Recupera le comunicazioni recenti dei rappresentanti seguiti
        const comunicazioniQuery = `
            SELECT c.*, vc.reaction as voto_utente
            FROM comunicazioni c
            LEFT JOIN voti_comunicazioni vc ON c.id = vc.comunicazione_id AND vc.user_id = $1
            WHERE c.id_utente = ANY($2::text[]) 
            AND c.data_creazione >= NOW() - INTERVAL '3 days'
            ORDER BY c.data_creazione DESC;
        `;
        const comunicazioniResult = await pool.query(comunicazioniQuery, [userId, rappresentantiSeguiti]);

        // 3. Recupera i dati (nome, avatar) dei rappresentanti seguiti
        const rappresentantiInfoQuery = `
            SELECT id, nome, cognome, avatar_config, grado_elezione 
            FROM utenti 
            WHERE id = ANY($1::text[]);
        `;
        const rappresentantiInfoResult = await pool.query(rappresentantiInfoQuery, [rappresentantiSeguiti]);
        
        // Formatta i dati dei rappresentanti in un oggetto per un facile accesso
        const rappresentantiInfoMap = rappresentantiInfoResult.rows.reduce((acc, curr) => {
            acc[curr.id] = curr;
            return acc;
        }, {});
        
        res.json({
            comunicazioni: comunicazioniResult.rows,
            rappresentantiInfo: rappresentantiInfoMap,
            preferenze: userData.notifiche_preferenze || {}
        });

    } catch (error) {
        console.error("Errore GET /api/notifiche:", error);
        res.status(500).json({ error: "Errore del server" });
    }
});


// POST /api/notifiche/preferenze - Salva le preferenze di notifica dell'utente
router.post('/preferenze', authenticateUser, async (req, res) => {
    const userId = req.user.uid;
    const { preferenze } = req.body;

    if (typeof preferenze !== 'object' || preferenze === null) {
        return res.status(400).json({ error: "Formato preferenze non valido." });
    }
    
    try {
        const query = 'UPDATE utenti SET notifiche_preferenze = $1 WHERE id = $2 RETURNING notifiche_preferenze';
        const result = await pool.query(query, [preferenze, userId]);
        res.status(200).json(result.rows[0].notifiche_preferenze);
    } catch (error) {
        console.error("Errore POST /api/notifiche/preferenze:", error);
        res.status(500).json({ error: "Errore del server" });
    }
});


app.use('/api/notifiche', notificheRouter);

// =============================================
//             COMUNICAZIONI
// =============================================



// File: api/comunicazioni.js



// GET /api/comunicazioni/check-duplicate?titolo=... - Controlla se una comunicazione esiste già
router.get('/check-duplicate', authenticateUser, async (req, res) => {
    const { titolo } = req.query;
    const userId = req.user.uid;

    if (!titolo) {
        return res.status(400).json({ error: "Il titolo è obbligatorio." });
    }

    try {
        // Determina la "zona" dell'utente che sta postando
        const userResult = await pool.query('SELECT grado_elezione, comune_elezione, provincia_elezione, regione_elezione, paese_elezione FROM utenti WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) return res.status(404).json({ error: "Utente non trovato" });

        const userData = userResult.rows[0];
        let zona = "Zona non specificata";
        if (userData.grado_elezione === "Comunale") zona = `Comune di ${userData.comune_elezione}`;
        else if (userData.grado_elezione === "Regionale") zona = `Regione ${userData.regione_elezione}`;
        // Aggiungi altre logiche per provincia, stato, etc.

        const query = 'SELECT titolo, vincitore, zona FROM comunicazioni WHERE titolo = $1 AND zona = $2 LIMIT 1';
        const result = await pool.query(query, [titolo, zona]);

        if (result.rows.length > 0) {
            res.json({ exists: true, comunicazione: result.rows[0] });
        } else {
            res.json({ exists: false });
        }
    } catch (error) {
        console.error("Errore GET /api/comunicazioni/check-duplicate:", error);
        res.status(500).json({ error: "Errore del server" });
    }
});


// POST /api/comunicazioni - Crea una nuova comunicazione
router.post('/', authenticateUser, async (req, res) => {
    const userId = req.user.uid;
    const { titolo, voto_dato, commento, vincitore } = req.body;

    if (!titolo || !voto_dato || !vincitore) {
        return res.status(400).json({ error: "Titolo, voto e vincitore sono obbligatori." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Recupera i dati dell'utente per arricchire la comunicazione
        const userResult = await client.query('SELECT nome, cognome, ruolo, grado_elezione, comune_elezione, provincia_elezione, regione_elezione, paese_elezione FROM utenti WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) throw new Error("Utente non trovato");
        
        const userData = userResult.rows[0];
        // Determina la zona
        let zona = "Zona non specificata";
        if (userData.grado_elezione === "Comunale") zona = `Comune di ${userData.comune_elezione}`;
        // ... (aggiungi altre logiche come sopra)

        // Inserisci la nuova comunicazione
        const insertQuery = `
            INSERT INTO comunicazioni (id_utente, titolo, voto_dato, commento, vincitore, zona)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;
        const result = await client.query(insertQuery, [userId, titolo, voto_dato, commento || null, vincitore, zona]);
        
        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Errore POST /api/comunicazioni:", error);
        res.status(500).json({ error: "Errore del server" });
    } finally {
        client.release();
    }
});


// POST /api/comunicazioni/:id/react - Aggiunge un like/dislike a una comunicazione
router.post('/:id/react', authenticateUser, async (req, res) => {
    const { id: comunicazioneId } = req.params;
    const userId = req.user.uid;
    const { reaction } = req.body; // 'like' o 'dislike'

    if (!['like', 'dislike'].includes(reaction)) {
        return res.status(400).json({ error: "Reazione non valida." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Controlla se l'utente ha già votato
        const existingVote = await client.query('SELECT * FROM voti_comunicazioni WHERE comunicazione_id = $1 AND user_id = $2', [comunicazioneId, userId]);
        if (existingVote.rows.length > 0) {
            return res.status(409).json({ error: "Hai già espresso una preferenza per questa comunicazione." });
        }

        // Inserisce il voto nella tabella di tracciamento
        await client.query('INSERT INTO voti_comunicazioni (comunicazione_id, user_id, reaction) VALUES ($1, $2, $3)', [comunicazioneId, userId, reaction]);

        // Aggiorna il contatore nella tabella principale
        const columnToUpdate = reaction === 'like' ? 'likes' : 'dislikes';
        await client.query(`UPDATE comunicazioni SET ${columnToUpdate} = ${columnToUpdate} + 1 WHERE id = $1`, [comunicazioneId]);

        await client.query('COMMIT');
        res.status(200).json({ success: true, message: "Reazione registrata." });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Errore POST /api/comunicazioni/${comunicazioneId}/react:`, error);
        res.status(500).json({ error: "Errore del server" });
    } finally {
        client.release();
    }
});

// GET /api/comunicazioni/ultima - Recupera l'ultima comunicazione dell'utente loggato (per la pagina Riscontro)
router.get('/ultima', authenticateUser, async (req, res) => {
    const userId = req.user.uid;
    try {
        const query = 'SELECT * FROM comunicazioni WHERE id_utente = $1 ORDER BY data_creazione DESC LIMIT 1';
        const result = await pool.query(query, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Nessuna comunicazione trovata." });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error("Errore GET /api/comunicazioni/ultima:", error);
        res.status(500).json({ error: "Errore del server" });
    }
});


app.use('/api/comunicazioni', comunicazioniRouter);

// =============================================
//              SOSTENITORI
// =============================================



// File: api/sostenitori.js
const sostenitoriRouter = express.Router();

// GET /api/sostenitori - Recupera le statistiche e la lista dei sostenitori dell'utente loggato
router.get('/', authenticateUser, async (req, res) => {
    const politicoId = req.user.uid;

    try {
        // Query per trovare tutti gli utenti che hanno il politicoId in uno dei campi rappresentante o candidato
        const supportersQuery = `
            SELECT 
                id as uid, nome, cognome, email, genere, data_nascita, comune_residenza,
                CASE WHEN rappresentante_europeo = $1 THEN 'Rapp. Europeo' ELSE NULL END as r1,
                CASE WHEN rappresentante_camera = $1 THEN 'Rapp. Camera' ELSE NULL END as r2,
                CASE WHEN rappresentante_senato = $1 THEN 'Rapp. Senato' ELSE NULL END as r3,
                CASE WHEN rappresentante_regionale = $1 THEN 'Rapp. Regionale' ELSE NULL END as r4,
                CASE WHEN rappresentante_comunale = $1 THEN 'Rapp. Comunale' ELSE NULL END as r5,
                CASE WHEN candidato_europeo = $1 THEN 'Cand. Europeo' ELSE NULL END as c1,
                CASE WHEN candidato_camera = $1 THEN 'Cand. Camera' ELSE NULL END as c2,
                CASE WHEN candidato_senato = $1 THEN 'Cand. Senato' ELSE NULL END as c3,
                CASE WHEN candidato_regionale = $1 THEN 'Cand. Regionale' ELSE NULL END as c4,
                CASE WHEN candidato_comunale = $1 THEN 'Cand. Comunale' ELSE NULL END as c5
            FROM utenti
            WHERE 
                rappresentante_europeo = $1 OR rappresentante_camera = $1 OR rappresentante_senato = $1 OR 
                rappresentante_regionale = $1 OR rappresentante_comunale = $1 OR
                candidato_europeo = $1 OR candidato_camera = $1 OR candidato_senato = $1 OR
                candidato_regionale = $1 OR candidato_comunale = $1;
        `;
        const supportersResult = await pool.query(supportersQuery, [politicoId]);
        
        const supporters = supportersResult.rows.map(row => {
            const supporterRoles = [row.r1, row.r2, row.r3, row.r4, row.r5, row.c1, row.c2, row.c3, row.c4, row.c5].filter(Boolean);
            // Rimuovi le colonne extra
            const { r1, r2, r3, r4, r5, c1, c2, c3, c4, c5, ...supporterData } = row;
            return { ...supporterData, supporterRoles };
        });

        if (supporters.length === 0) {
            return res.json({
                stats: { totalSupporters: 0, genderDistribution: {}, locationDistribution: {}, averageAge: 0, ageDistribution: {} },
                supporters: [],
                supportersPolitico: [],
                supportersCandidato: [],
                supportersBoth: []
            });
        }

        // Calcola statistiche (questa logica ora è sul server!)
        const getAge = (birthDate) => new Date().getFullYear() - new Date(birthDate).getFullYear();
        
        let ageSum = 0;
        const stats = {
            totalSupporters: supporters.length,
            genderDistribution: { Maschio: 0, Femmina: 0, Altro: 0 },
            locationDistribution: {},
            ageDistribution: { '18-25': 0, '26-35': 0, '36-45': 0, '46-55': 0, '56-65': 0, '65+': 0 }
        };

        supporters.forEach(s => {
            if (s.genere === 'Maschio') stats.genderDistribution.Maschio++;
            else if (s.genere === 'Femmina') stats.genderDistribution.Femmina++;
            else stats.genderDistribution.Altro++;

            if (s.comune_residenza) {
                stats.locationDistribution[s.comune_residenza] = (stats.locationDistribution[s.comune_residenza] || 0) + 1;
            }
            
            if (s.data_nascita) {
                const age = getAge(s.data_nascita);
                ageSum += age;
                if (age <= 25) stats.ageDistribution['18-25']++;
                else if (age <= 35) stats.ageDistribution['26-35']++;
                else if (age <= 45) stats.ageDistribution['36-45']++;
                else if (age <= 55) stats.ageDistribution['46-55']++;
                else if (age <= 65) stats.ageDistribution['56-65']++;
                else stats.ageDistribution['65+']++;
            }
        });
        stats.averageAge = supporters.length > 0 ? ageSum / supporters.length : 0;
        
        // Filtra le liste per tipo (politico, candidato, entrambi)
        const supportersPolitico = supporters.filter(s => s.supporterRoles.some(r => r.startsWith('Rapp.')));
        const supportersCandidato = supporters.filter(s => s.supporterRoles.some(r => r.startsWith('Cand.')));
        const supportersBoth = supporters.filter(s => 
            s.supporterRoles.some(r => r.startsWith('Rapp.')) &&
            s.supporterRoles.some(r => r.startsWith('Cand.'))
        );

        res.json({ stats, supporters, supportersPolitico, supportersCandidato, supportersBoth });

    } catch (error) {
        console.error("Errore GET /api/sostenitori:", error);
        res.status(500).json({ error: "Errore del server" });
    }
});

app.use('/api/sostenitori', sostenitoriRouter);

// Router per le notifiche
const notificationsRouter = require('./notifications.js');
app.use('/api/notifications', notificationsRouter);

// Test endpoint semplice
app.get('/test', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Test endpoint working!',
    timestamp: new Date().toISOString()
  });
});

// Health Check semplificato (prima di tutti i router)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'API health check working!',
    timestamp: new Date().toISOString()
  });
});

// Health Check con /api prefix
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'API health check working!',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url
  });
});

// Gestore 404 (deve stare alla fine)
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Esporta l'app per Vercel
module.exports = app;