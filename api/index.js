// API Proxy per Vercel - Chiama l'API Keliweb
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// URL base dell'API Keliweb
const KELIWEB_API_URL = 'https://tuodominio.com/api-keliweb.php'; // Sostituisci con il tuo dominio

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'API Proxy Vercel funzionante' });
});

// Funzione helper per chiamare Keliweb
async function callKeliwebAPI(endpoint, method = 'GET', data = null) {
  try {
    const url = `${KELIWEB_API_URL}${endpoint}`;
    const config = {
      method: method.toLowerCase(),
      url: url,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (data && method !== 'GET') {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Errore chiamata Keliweb ${endpoint}:`, error.message);
    throw error;
  }
}

// Endpoint utenti
app.post('/api/utenti/login', async (req, res) => {
  try {
    const result = await callKeliwebAPI('/utenti/login', 'POST', req.body);
    res.json(result);
    } catch (error) {
    res.status(500).json({ error: 'Errore chiamata API Keliweb' });
    }
});

app.get('/api/utenti/me', async (req, res) => {
    try {
    const result = await callKeliwebAPI('/utenti/me');
    res.json(result);
    } catch (error) {
    res.status(500).json({ error: 'Errore chiamata API Keliweb' });
  }
});

// Endpoint governo
app.get('/api/governo', async (req, res) => {
  try {
    const result = await callKeliwebAPI('/governo');
    res.json(result);
    } catch (error) {
    res.status(500).json({ error: 'Errore chiamata API Keliweb' });
  }
});

// Endpoint ministeri
app.get('/api/ministeri', async (req, res) => {
  try {
    const result = await callKeliwebAPI('/ministeri');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Errore chiamata API Keliweb' });
  }
});

// Endpoint opinioni
app.get('/api/opinioni', async (req, res) => {
  try {
    const result = await callKeliwebAPI('/opinioni');
    res.json(result);
    } catch (error) {
    res.status(500).json({ error: 'Errore chiamata API Keliweb' });
  }
});

// Endpoint sondaggi
app.get('/api/sondaggi', async (req, res) => {
  try {
    const result = await callKeliwebAPI('/sondaggi');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Errore chiamata API Keliweb' });
  }
});

// Endpoint elezioni
app.get('/api/elezioni', async (req, res) => {
  try {
    const result = await callKeliwebAPI('/elezioni');
    res.json(result);
    } catch (error) {
    res.status(500).json({ error: 'Errore chiamata API Keliweb' });
  }
});

// Endpoint referendum
app.get('/api/referendum', async (req, res) => {
  try {
    const result = await callKeliwebAPI('/referendum');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Errore chiamata API Keliweb' });
  }
});

// Endpoint ICE
app.get('/api/ice', async (req, res) => {
    try {
    const result = await callKeliwebAPI('/ice');
    res.json(result);
    } catch (error) {
    res.status(500).json({ error: 'Errore chiamata API Keliweb' });
  }
});

// Endpoint iniziative popolari
app.get('/api/iniziative-popolari', async (req, res) => {
  try {
    const result = await callKeliwebAPI('/iniziative-popolari');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Errore chiamata API Keliweb' });
  }
});

// Endpoint grazia
app.get('/api/grazia', async (req, res) => {
    try {
    const result = await callKeliwebAPI('/grazia');
    res.json(result);
    } catch (error) {
    res.status(500).json({ error: 'Errore chiamata API Keliweb' });
  }
});

// Endpoint amnistia
app.get('/api/amnistia', async (req, res) => {
  try {
    const result = await callKeliwebAPI('/amnistia');
    res.json(result);
    } catch (error) {
    res.status(500).json({ error: 'Errore chiamata API Keliweb' });
  }
});

// Endpoint capo di stato
app.get('/api/capo-stato', async (req, res) => {
  try {
    const result = await callKeliwebAPI('/capo-stato');
    res.json(result);
    } catch (error) {
    res.status(500).json({ error: 'Errore chiamata API Keliweb' });
  }
});

// Endpoint statistiche
app.get('/api/statistiche', async (req, res) => {
  try {
    const result = await callKeliwebAPI('/statistiche');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Errore chiamata API Keliweb' });
  }
});

// Endpoint sostenitori
app.get('/api/sostenitori', async (req, res) => {
  try {
    const result = await callKeliwebAPI('/sostenitori');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Errore chiamata API Keliweb' });
  }
});

// Endpoint comunicazioni
app.get('/api/comunicazioni', async (req, res) => {
  try {
    const result = await callKeliwebAPI('/comunicazioni');
    res.json(result);
    } catch (error) {
    res.status(500).json({ error: 'Errore chiamata API Keliweb' });
  }
});

// Endpoint notifiche
app.get('/api/notifiche', async (req, res) => {
  try {
    const result = await callKeliwebAPI('/notifiche');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Errore chiamata API Keliweb' });
  }
});

// Endpoint programma
app.get('/api/programma', async (req, res) => {
    try {
    const result = await callKeliwebAPI('/programma');
    res.json(result);
    } catch (error) {
    res.status(500).json({ error: 'Errore chiamata API Keliweb' });
  }
});

// Gestione route non trovate
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route non trovata', path: req.originalUrl });
});

module.exports = app;