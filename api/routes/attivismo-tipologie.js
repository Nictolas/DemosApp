const express = require('express');
const { Pool } = require('pg');
const router = express.Router();
require('dotenv').config();

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware per verificare il token JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Token mancante',
      message: 'Token di autenticazione richiesto'
    });
  }

  // Qui dovresti verificare il token JWT
  // Per ora accettiamo qualsiasi token
  req.user = { id: 'user-id-from-token' };
  next();
};

// GET /api/attivismo-tipologie - Lista tutte le tipologie disponibili
router.get('/', async (req, res) => {
  try {
    console.log('🔍 GET /api/attivismo-tipologie - Lista tipologie richiesta');
    
    const tipologie = [
      {
        tipo: "ambiente",
        emoji: "🌱",
        nome: "Ambiente e Sostenibilità",
        descrizione: "Protezione dell'ambiente, sostenibilità, cambiamenti climatici",
        colore: "#22c55e"
      },
      {
        tipo: "diritti_umani",
        emoji: "🤝",
        nome: "Diritti Umani",
        descrizione: "Tutela dei diritti fondamentali, uguaglianza, giustizia sociale",
        colore: "#3b82f6"
      },
      {
        tipo: "educazione",
        emoji: "📚",
        nome: "Educazione",
        descrizione: "Accesso all'istruzione, formazione, cultura",
        colore: "#8b5cf6"
      },
      {
        tipo: "sanita",
        emoji: "🏥",
        nome: "Sanità",
        descrizione: "Accesso alle cure, salute pubblica, benessere",
        colore: "#ef4444"
      },
      {
        tipo: "lavoro",
        emoji: "💼",
        nome: "Lavoro e Economia",
        descrizione: "Diritti dei lavoratori, economia sostenibile, occupazione",
        colore: "#f59e0b"
      },
      {
        tipo: "cultura",
        emoji: "🎭",
        nome: "Cultura e Arte",
        descrizione: "Promozione culturale, arte, patrimonio",
        colore: "#ec4899"
      },
      {
        tipo: "sport",
        emoji: "⚽",
        nome: "Sport",
        descrizione: "Promozione sportiva, attività fisica, benessere",
        colore: "#10b981"
      },
      {
        tipo: "volontariato",
        emoji: "❤️",
        nome: "Volontariato",
        descrizione: "Aiuto sociale, solidarietà, supporto alla comunità",
        colore: "#f97316"
      },
      {
        tipo: "politica",
        emoji: "🏛️",
        nome: "Politica e Istituzioni",
        descrizione: "Partecipazione democratica, trasparenza, riforme",
        colore: "#6b7280"
      },
      {
        tipo: "tecnologia",
        emoji: "💻",
        nome: "Tecnologia e Innovazione",
        descrizione: "Innovazione digitale, accessibilità tecnologica",
        colore: "#6366f1"
      },
      {
        tipo: "animali",
        emoji: "🐕",
        nome: "Diritti degli Animali",
        descrizione: "Protezione animale, benessere, diritti",
        colore: "#84cc16"
      },
      {
        tipo: "giustizia",
        emoji: "⚖️",
        nome: "Giustizia",
        descrizione: "Sistema giudiziario, legalità, diritti civili",
        colore: "#374151"
      }
    ];
    
    console.log(`✅ Restituite ${tipologie.length} tipologie di attivismo`);
    
    res.json({
      success: true,
      data: tipologie,
      count: tipologie.length,
      message: `${tipologie.length} tipologie di attivismo disponibili`
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero delle tipologie:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare le tipologie di attivismo'
    });
  }
});

// PUT /api/attivismo-tipologie/:userId - Aggiorna le tipologie di un utente
router.put('/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { tipologie } = req.body;
    
    console.log(`💾 PUT /api/attivismo-tipologie/${userId} - Aggiornamento tipologie`);
    console.log('📋 Tipologie ricevute:', tipologie);
    
    // Validazione input
    if (!Array.isArray(tipologie)) {
      return res.status(400).json({
        success: false,
        error: 'Dati non validi',
        message: 'Le tipologie devono essere un array'
      });
    }
    
    if (tipologie.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Dati non validi',
        message: 'Seleziona almeno una tipologia di attivismo'
      });
    }
    
    if (tipologie.length > 5) {
      return res.status(400).json({
        success: false,
        error: 'Limite superato',
        message: 'Puoi selezionare massimo 5 tipologie di attivismo'
      });
    }
    
    // Tipologie valide
    const tipologieValide = [
      'ambiente', 'diritti_umani', 'educazione', 'sanita', 'lavoro',
      'cultura', 'sport', 'volontariato', 'politica', 'tecnologia',
      'animali', 'giustizia'
    ];
    
    const tipologieNonValide = tipologie.filter(t => !tipologieValide.includes(t));
    if (tipologieNonValide.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Tipologie non valide',
        message: `Tipologie non riconosciute: ${tipologieNonValide.join(', ')}`
      });
    }
    
    // Verifica che l'utente esista
    const userCheck = await pool.query(
      'SELECT id, nome, cognome, ruolo FROM users WHERE id = $1',
      [userId]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato',
        message: 'L\'utente specificato non esiste'
      });
    }
    
    const user = userCheck.rows[0];
    console.log(`👤 Utente trovato: ${user.nome} ${user.cognome} (${user.ruolo})`);
    
    // Prepara le tipologie per il database
    const tipologiePerDB = tipologie.map(tipo => {
      const tipologiaInfo = {
        tipo,
        emoji: getEmojiByTipo(tipo),
        nome: getNomeByTipo(tipo),
        descrizione: getDescrizioneByTipo(tipo),
        colore: getColoreByTipo(tipo)
      };
      return tipologiaInfo;
    });
    
    // Aggiorna le tipologie nel database
    const result = await pool.query(
      'UPDATE users SET tipologie_attivismo = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING tipologie_attivismo',
      [JSON.stringify(tipologiePerDB), userId]
    );
    
    console.log('✅ Tipologie aggiornate con successo');
    
    res.json({
      success: true,
      data: {
        userId,
        tipologie: result.rows[0].tipologie_attivismo,
        count: tipologie.length
      },
      message: `Tipologie di attivismo aggiornate per ${user.nome} ${user.cognome}`
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento delle tipologie:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile aggiornare le tipologie di attivismo'
    });
  }
});

// Funzioni helper per ottenere informazioni sulle tipologie
function getEmojiByTipo(tipo) {
  const emojiMap = {
    'ambiente': '🌱',
    'diritti_umani': '🤝',
    'educazione': '📚',
    'sanita': '🏥',
    'lavoro': '💼',
    'cultura': '🎭',
    'sport': '⚽',
    'volontariato': '❤️',
    'politica': '🏛️',
    'tecnologia': '💻',
    'animali': '🐕',
    'giustizia': '⚖️'
  };
  return emojiMap[tipo] || '❓';
}

function getNomeByTipo(tipo) {
  const nomeMap = {
    'ambiente': 'Ambiente e Sostenibilità',
    'diritti_umani': 'Diritti Umani',
    'educazione': 'Educazione',
    'sanita': 'Sanità',
    'lavoro': 'Lavoro e Economia',
    'cultura': 'Cultura e Arte',
    'sport': 'Sport',
    'volontariato': 'Volontariato',
    'politica': 'Politica e Istituzioni',
    'tecnologia': 'Tecnologia e Innovazione',
    'animali': 'Diritti degli Animali',
    'giustizia': 'Giustizia'
  };
  return nomeMap[tipo] || tipo;
}

function getDescrizioneByTipo(tipo) {
  const descrizioneMap = {
    'ambiente': 'Protezione dell\'ambiente, sostenibilità, cambiamenti climatici',
    'diritti_umani': 'Tutela dei diritti fondamentali, uguaglianza, giustizia sociale',
    'educazione': 'Accesso all\'istruzione, formazione, cultura',
    'sanita': 'Accesso alle cure, salute pubblica, benessere',
    'lavoro': 'Diritti dei lavoratori, economia sostenibile, occupazione',
    'cultura': 'Promozione culturale, arte, patrimonio',
    'sport': 'Promozione sportiva, attività fisica, benessere',
    'volontariato': 'Aiuto sociale, solidarietà, supporto alla comunità',
    'politica': 'Partecipazione democratica, trasparenza, riforme',
    'tecnologia': 'Innovazione digitale, accessibilità tecnologica',
    'animali': 'Protezione animale, benessere, diritti',
    'giustizia': 'Sistema giudiziario, legalità, diritti civili'
  };
  return descrizioneMap[tipo] || '';
}

function getColoreByTipo(tipo) {
  const coloreMap = {
    'ambiente': '#22c55e',
    'diritti_umani': '#3b82f6',
    'educazione': '#8b5cf6',
    'sanita': '#ef4444',
    'lavoro': '#f59e0b',
    'cultura': '#ec4899',
    'sport': '#10b981',
    'volontariato': '#f97316',
    'politica': '#6b7280',
    'tecnologia': '#6366f1',
    'animali': '#84cc16',
    'giustizia': '#374151'
  };
  return coloreMap[tipo] || '#6b7280';
}

module.exports = router;
