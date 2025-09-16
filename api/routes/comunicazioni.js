const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  // Usa sempre Neon per ora
  connectionString: 'postgresql://neondb_owner:[REDACTED_NEON_PASSWORD]@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// ===== ENDPOINTS PER COMUNICAZIONI =====

// GET /api/comunicazioni - Lista comunicazioni
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM comunicazioni ORDER BY data_creazione DESC'
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recupero comunicazioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/comunicazioni - Crea o aggiorna comunicazione
router.post('/', async (req, res) => {
  try {
    const {
      titolo,
      voto_dato,
      commento,
      vincitore,
      zona,
      id_utente,
      tipo = 'votazione',
      voti // Array di voti per "Comunica Voti"
    } = req.body;

    if (!titolo || !id_utente) {
      return res.status(400).json({
        success: false,
        error: 'Titolo e ID utente sono obbligatori'
      });
    }

    // Se ci sono voti multipli (Comunica Voti), gestisci ogni voto
    if (voti && Array.isArray(voti) && voti.length > 0) {
      const comunicazioni = [];

      for (const voto of voti) {
        if (!voto.nome || !voto.voto) continue;

        // Cerca l'utente Politico/Candidato Politico per nome
        const utenteResult = await pool.query(
          `SELECT id, nome, cognome, ruolo FROM utenti 
           WHERE (nome ILIKE $1 OR cognome ILIKE $1 OR CONCAT(nome, ' ', cognome) ILIKE $1)
           AND ruolo IN ('Politico', 'Candidato Politico')
           LIMIT 1`,
          [`%${voto.nome}%`]
        );

        if (utenteResult.rows.length === 0) {
          console.log(`⚠️ Utente non trovato per: ${voto.nome}`);
          continue;
        }

        const utentePolitico = utenteResult.rows[0];
        const testo = `Il voto di ${utentePolitico.nome} ${utentePolitico.cognome}: ${voto.voto}`;
        const titoloCompleto = `${titolo} - ${utentePolitico.nome} ${utentePolitico.cognome}`;

        // Controlla se esiste già una comunicazione per questo utente politico
        const existingComunicazione = await pool.query(
          'SELECT id FROM comunicazioni WHERE id_utente = $1 AND tipo = $2 ORDER BY data_creazione DESC LIMIT 1',
          [utentePolitico.id, 'comunica_voti']
        );

        if (existingComunicazione.rows.length > 0) {
          // Aggiorna comunicazione esistente
          const comunicazioneId = existingComunicazione.rows[0].id;
          
          // Reset like/dislike
          await pool.query(
            'DELETE FROM reazioni WHERE comunicazione_id = $1',
            [comunicazioneId]
          );

          const result = await pool.query(
            `UPDATE comunicazioni SET 
              titolo = $1, 
              testo = $2, 
              voto_dato = $3, 
              vincitore = $4, 
              commento = $5,
              data_creazione = NOW(),
              likes = 0,
              dislikes = 0
            WHERE id = $6 
            RETURNING *`,
            [titoloCompleto, testo, voto.voto, vincitore, commento || '', comunicazioneId]
          );

          comunicazioni.push(result.rows[0]);

          // Invia notifica ai sostenitori
          await notifySostenitori(utentePolitico.id, titoloCompleto, result.rows[0]);
        } else {
          // Crea nuova comunicazione
          const result = await pool.query(
            `INSERT INTO comunicazioni (
              id, id_utente, titolo, testo, zona, voto_dato, vincitore, commento,
              data_creazione, likes, dislikes, punti_trasparenza, tipo
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), 0, 0, 3, $8
            ) RETURNING *`,
            [utentePolitico.id, titoloCompleto, testo, zona || 'Generale', voto.voto, vincitore, commento || '', 'comunica_voti']
          );

          comunicazioni.push(result.rows[0]);

          // Invia notifica ai sostenitori
          await notifySostenitori(utentePolitico.id, titoloCompleto, result.rows[0]);
        }
      }

      return res.status(201).json({
        success: true,
        data: comunicazioni,
        message: `${comunicazioni.length} voti salvati con successo`
      });
    }

    // Gestione speciale per notifiche di Demos
    if (tipo === 'demos_notification') {
      const testo = `Notifica Demos: ${commento || ''}`;
      
      // Controlla se esiste già una notifica Demos e la sovrascrivi
      const existingDemosNotification = await pool.query(
        'SELECT id FROM comunicazioni WHERE tipo = $1 ORDER BY data_creazione DESC LIMIT 1',
        ['demos_notification']
      );

      let result;
      if (existingDemosNotification.rows.length > 0) {
        // Aggiorna notifica esistente
        const comunicazioneId = existingDemosNotification.rows[0].id;
        
        // Reset like/dislike
        await pool.query(
          'DELETE FROM reazioni WHERE comunicazione_id = $1',
          [comunicazioneId]
        );

        result = await pool.query(
          `UPDATE comunicazioni SET
            id_utente = $1,
            titolo = $2,
            testo = $3,
            zona = $4,
            commento = $5,
            data_creazione = NOW(),
            likes = 0,
            dislikes = 0,
            punti_trasparenza = 0
          WHERE id = $6
          RETURNING *`,
          [id_utente, titolo, testo, zona || 'Generale', commento || '', comunicazioneId]
        );
      } else {
        // Crea nuova notifica Demos
        result = await pool.query(
          `INSERT INTO comunicazioni (
            id, id_utente, titolo, testo, zona, voto_dato, vincitore, commento,
            data_creazione, likes, dislikes, punti_trasparenza, tipo
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), 0, 0, 0, $8
          ) RETURNING *`,
          [id_utente, titolo, testo, zona || 'Generale', null, null, commento || '', tipo]
        );
      }

      // Invia notifica a TUTTI gli utenti
      await notifyAllUsers(titolo, commento || '');

      return res.status(201).json({
        success: true,
        data: result.rows[0],
        message: 'Notifica Demos inviata a tutti gli utenti'
      });
    }

    // Per "Nuova Comunicazione Votazione", controlla se esiste già una comunicazione per questo utente
    const existingComunicazione = await pool.query(
      'SELECT id FROM comunicazioni WHERE id_utente = $1 AND tipo = $2 ORDER BY data_creazione DESC LIMIT 1',
      [id_utente, tipo]
    );

    const testo = `Voto: ${voto_dato || 'Non specificato'}${commento ? ` - Commento: ${commento}` : ''}`;

    if (existingComunicazione.rows.length > 0) {
      // Aggiorna comunicazione esistente
      const comunicazioneId = existingComunicazione.rows[0].id;
      
      // Reset like/dislike
      await pool.query(
        'DELETE FROM reazioni WHERE comunicazione_id = $1',
        [comunicazioneId]
      );

      const result = await pool.query(
        `UPDATE comunicazioni SET 
          titolo = $1, 
          testo = $2, 
          voto_dato = $3, 
          vincitore = $4, 
          commento = $5,
          data_creazione = NOW(),
          likes = 0,
          dislikes = 0
        WHERE id = $6 
        RETURNING *`,
        [titolo, testo, voto_dato, vincitore, commento || '', comunicazioneId]
      );

      // Invia notifica ai sostenitori
      await notifySostenitori(id_utente, titolo, result.rows[0]);

      res.status(200).json({
        success: true,
        data: result.rows[0],
        message: 'Comunicazione aggiornata con successo'
      });
    } else {
      // Crea nuova comunicazione
      const result = await pool.query(
        `INSERT INTO comunicazioni (
          id, id_utente, titolo, testo, zona, voto_dato, vincitore, commento,
          data_creazione, likes, dislikes, punti_trasparenza, tipo
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), 0, 0, 3, $8
        ) RETURNING *`,
        [id_utente, titolo, testo, zona || 'Generale', voto_dato, vincitore, commento || '', tipo]
      );

      // Invia notifica ai sostenitori
      await notifySostenitori(id_utente, titolo, result.rows[0]);

      res.status(201).json({
        success: true,
        data: result.rows[0]
      });
    }
  } catch (error) {
    console.error('❌ Errore nella creazione/aggiornamento comunicazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// Funzione per notificare i sostenitori
async function notifySostenitori(utenteId, titolo, comunicazione) {
  try {
    // Recupera i sostenitori dell'utente
    const sostenitoriResult = await pool.query(
      'SELECT utente_id FROM sostenitori WHERE sostenuto_id = $1',
      [utenteId]
    );

    if (sostenitoriResult.rows.length === 0) return;

    // Crea notifiche per ogni sostenitore
    const notifiche = sostenitoriResult.rows.map(sostenitore => ({
      utente_id: sostenitore.utente_id,
      titolo: `Nuova comunicazione da ${comunicazione.titolo}`,
      messaggio: `Il tuo sostenuto ha pubblicato una nuova comunicazione: "${titolo}"`,
      tipo: 'comunicazione_aggiornata',
      priorita: 'media'
    }));

    // Inserisci le notifiche
    for (const notifica of notifiche) {
      await pool.query(
        `INSERT INTO notifiche_utente (id, utente_id, titolo, messaggio, tipo, priorita, data_creazione)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())`,
        [notifica.utente_id, notifica.titolo, notifica.messaggio, notifica.tipo, notifica.priorita]
      );
    }

    console.log(`✅ Notifiche inviate a ${sostenitoriResult.rows.length} sostenitori`);
  } catch (error) {
    console.error('❌ Errore nell\'invio notifiche ai sostenitori:', error);
  }
}

// Funzione per notificare tutti gli utenti (per notifiche Demos)
async function notifyAllUsers(titolo, commento) {
  try {
    // Recupera tutti gli utenti attivi
    const utentiResult = await pool.query(
      'SELECT id FROM utenti WHERE status = $1 OR status IS NULL',
      ['active']
    );

    if (utentiResult.rows.length === 0) return;

    // Crea notifiche per ogni utente
    const notifiche = utentiResult.rows.map(utente => ({
      utente_id: utente.id,
      titolo: `Notifica Demos: ${titolo}`,
      messaggio: commento,
      tipo: 'demos_notification',
      priorita: 'alta'
    }));

    // Inserisci le notifiche in batch per performance
    const batchSize = 100;
    for (let i = 0; i < notifiche.length; i += batchSize) {
      const batch = notifiche.slice(i, i + batchSize);
      const values = batch.map((notifica, index) => {
        const baseIndex = i + index;
        return `(gen_random_uuid(), $${baseIndex * 4 + 1}, $${baseIndex * 4 + 2}, $${baseIndex * 4 + 3}, $${baseIndex * 4 + 4}, NOW())`;
      }).join(', ');
      
      const params = batch.flatMap(notifica => [
        notifica.utente_id, 
        notifica.titolo, 
        notifica.messaggio, 
        notifica.tipo
      ]);

      await pool.query(
        `INSERT INTO notifiche_utente (id, utente_id, titolo, messaggio, tipo, data_creazione) VALUES ${values}`,
        params
      );
    }

    console.log(`✅ Notifiche Demos inviate a ${utentiResult.rows.length} utenti`);
  } catch (error) {
    console.error('❌ Errore nell\'invio notifiche Demos:', error);
  }
}

// GET /api/ultima-comunicazione - Ultima comunicazione dell'utente
router.get('/ultima-comunicazione', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'ID utente richiesto'
      });
    }
    
    const result = await pool.query(
      `SELECT 
        c.*,
        COALESCE(SUM(CASE WHEN r.tipo = 'like' THEN 1 ELSE 0 END), 0) as likes,
        COALESCE(SUM(CASE WHEN r.tipo = 'dislike' THEN 1 ELSE 0 END), 0) as dislikes
      FROM comunicazioni c
      LEFT JOIN reazioni r ON c.id = r.comunicazione_id
      WHERE c.id_utente = $1
      GROUP BY c.id
      ORDER BY c.data_creazione DESC
      LIMIT 1`,
      [user_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Nessuna comunicazione trovata'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nel recupero ultima comunicazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
