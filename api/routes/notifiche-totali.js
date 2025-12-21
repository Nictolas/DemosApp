const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
require('dotenv').config();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

// GET /api/notifiche-totali - Lista tutte le notifiche (solo admin)
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/notifiche-totali - Inizio richiesta');
    
    const userId = req.user?.id || req.user?.userId;
    console.log('🔍 User ID:', userId);
    
    if (!userId) {
      console.error('❌ User ID non trovato in req.user');
      return res.status(401).json({
        success: false,
        error: 'Utente non autenticato'
      });
    }
    
    // Verifica se l'utente è admin
    let userResult;
    try {
      userResult = await pool.query(
        'SELECT is_admin, ruolo FROM users WHERE id = $1',
        [userId]
      );
      console.log('🔍 Risultato query utente:', userResult.rows.length > 0 ? 'Trovato' : 'Non trovato');
    } catch (userError) {
      console.error('❌ Errore query utente:', userError);
      throw userError;
    }
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const isAdmin = userResult.rows[0].is_admin === true || userResult.rows[0].ruolo === 'AD';
    console.log('🔍 Is Admin:', isAdmin);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato. Solo gli amministratori possono accedere a questa risorsa.'
      });
    }

    // Verifica che le tabelle esistano prima di eseguire le query
    let tableCheck;
    try {
      tableCheck = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('notifiche_voti_comuni', 'notifiche_demos', 'notifiche_comunali')
      `);
      console.log('📋 Query tabelle eseguita con successo');
    } catch (tableError) {
      console.error('❌ Errore verifica tabelle:', tableError);
      throw tableError;
    }
    
    const existingTables = tableCheck.rows.map(r => r.table_name);
    console.log('📋 Tabelle notifiche trovate:', existingTables);

    // Recupera tutte le notifiche dalle tre tabelle (solo se esistono)
    const queries = [];
    
    if (existingTables.includes('notifiche_voti_comuni')) {
      queries.push(
        pool.query(`
          SELECT 
            id,
            id_utente,
            titolo,
            testo,
            COALESCE(data, CURRENT_DATE) as data,
            voto,
            comune_residenza,
            politico,
            COALESCE(likes, 0) as likes,
            COALESCE(dislikes, 0) as dislikes,
            'notifiche_voti_comuni' as tabella_origine
          FROM notifiche_voti_comuni
          ORDER BY COALESCE(data, CURRENT_DATE) DESC
          LIMIT 100
        `).catch(err => {
          console.error('❌ Errore query notifiche_voti_comuni:', err);
          console.error('❌ Error details:', {
            message: err.message,
            code: err.code,
            detail: err.detail
          });
          return { rows: [] };
        })
      );
    } else {
      console.log('⚠️ Tabella notifiche_voti_comuni non trovata');
      queries.push(Promise.resolve({ rows: [] }));
    }
    
    if (existingTables.includes('notifiche_demos')) {
      queries.push(
        pool.query(`
          SELECT 
            id,
            id_utente,
            titolo,
            testo,
            COALESCE(data, CURRENT_DATE) as data,
            NULL::TEXT as comune_residenza,
            'notifiche_demos' as tabella_origine,
            NULL::TEXT as voto,
            NULL::TEXT as politico,
            0::INTEGER as likes,
            0::INTEGER as dislikes
          FROM notifiche_demos
          ORDER BY COALESCE(data, CURRENT_DATE) DESC
          LIMIT 100
        `).catch(err => {
          console.error('❌ Errore query notifiche_demos:', err);
          console.error('❌ Error details:', {
            message: err.message,
            code: err.code,
            detail: err.detail
          });
          return { rows: [] };
        })
      );
    } else {
      console.log('⚠️ Tabella notifiche_demos non trovata');
      queries.push(Promise.resolve({ rows: [] }));
    }
    
    if (existingTables.includes('notifiche_comunali')) {
      queries.push(
        pool.query(`
          SELECT 
            id,
            id_utente,
            COALESCE(titolo, 
              CASE 
                WHEN tipologia IS NOT NULL AND dove IS NOT NULL THEN tipologia || ' - ' || dove
                WHEN tipologia IS NOT NULL THEN tipologia
                WHEN dove IS NOT NULL THEN dove
                ELSE 'Notifica Comunale'
              END
            ) as titolo,
            COALESCE(testo,
              CASE 
                WHEN tipologia IS NOT NULL OR dove IS NOT NULL OR dal_giorno IS NOT NULL OR al_giorno IS NOT NULL THEN
                  COALESCE('Tipologia: ' || tipologia, '') ||
                  CASE WHEN tipologia IS NOT NULL THEN E'\\n' ELSE '' END ||
                  COALESCE('Dove: ' || dove, '') ||
                  CASE WHEN dove IS NOT NULL THEN E'\\n' ELSE '' END ||
                  COALESCE('Dal: ' || dal_giorno::text, '') ||
                  CASE WHEN dal_giorno IS NOT NULL THEN E'\\n' ELSE '' END ||
                  COALESCE('Al: ' || al_giorno::text, '')
                ELSE 'Notifica comunale'
              END
            ) as testo,
            COALESCE(data, dal_giorno, CURRENT_DATE) as data,
            COALESCE(comune_residenza, dove, zona) as comune_residenza,
            NULL::INTEGER as likes,
            NULL::INTEGER as dislikes
          FROM notifiche_comunali
          ORDER BY COALESCE(data, dal_giorno, CURRENT_DATE) DESC
          LIMIT 100
        `).catch(err => {
          console.error('❌ Errore query notifiche_comunali:', err);
          console.error('❌ Error details:', {
            message: err.message,
            code: err.code,
            detail: err.detail
          });
          return { rows: [] };
        })
      );
    } else {
      console.log('⚠️ Tabella notifiche_comunali non trovata');
      queries.push(Promise.resolve({ rows: [] }));
    }
    
    console.log('🔍 Esecuzione query per recuperare notifiche...');
    let votiComuni, demos, comunali;
    
    try {
      [votiComuni, demos, comunali] = await Promise.all(queries);
      console.log('✅ Query eseguite con successo');
      console.log(`📊 Notifiche recuperate: voti_comuni=${votiComuni.rows.length}, demos=${demos.rows.length}, comunali=${comunali.rows.length}`);
    } catch (queryError) {
      console.error('❌ Errore durante esecuzione query:', queryError);
      console.error('❌ Stack trace:', queryError.stack);
      throw queryError;
    }

    // Combina tutte le notifiche
    const allNotifiche = [
      ...(votiComuni?.rows || []),
      ...(demos?.rows || []),
      ...(comunali?.rows || [])
    ].sort((a, b) => {
      const dateA = a.data ? new Date(a.data) : new Date(0);
      const dateB = b.data ? new Date(b.data) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

    console.log(`✅ Totale notifiche combinate: ${allNotifiche.length}`);

    res.json({
      success: true,
      notifiche: {
        voti_comuni: votiComuni?.rows || [],
        demos: demos?.rows || [],
        comunali: comunali?.rows || []
      },
      stats: {
        voti_comuni: votiComuni?.rows?.length || 0,
        demos: demos?.rows?.length || 0,
        comunali: comunali?.rows?.length || 0,
        totali: allNotifiche.length
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recupero notifiche totali:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error stack:', error.stack);
    
    // Se la risposta non è già stata inviata
    if (!res.headersSent) {
      // Restituisci una risposta valida anche in caso di errore
      // per evitare che la pagina frontend mostri solo un errore
      res.status(200).json({
        success: true,
        notifiche: [],
        stats: {
          voti_comuni: 0,
          demos: 0,
          comunali: 0,
          totali: 0
        },
        error: error.message,
        debug: process.env.NODE_ENV === 'development' ? {
          code: error.code,
          stack: error.stack
        } : undefined
      });
    } else {
      console.error('❌ Headers già inviati, impossibile inviare risposta di errore');
    }
  }
});

module.exports = router;

