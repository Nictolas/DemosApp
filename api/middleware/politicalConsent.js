const { getPool } = require('../config/database');
const { getPoliticalConsentState } = require('../services/politicalConsentService');

async function requirePoliticalConsent(req, res, next) {
  try {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Autenticazione richiesta'
      });
    }

    const state = await getPoliticalConsentState(getPool(), userId);
    if (!state.exists) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    if (!state.granted) {
      return res.status(403).json({
        success: false,
        error: 'Consenso richiesto',
        code: 'POLITICAL_CONSENT_REQUIRED',
        message: 'Questa funzione tratta una scelta o opinione politica e richiede un consenso esplicito attivo.',
        consent_required: true
      });
    }

    next();
  } catch (error) {
    console.error('❌ Errore nel controllo consenso politico:', error);
    return res.status(500).json({
      success: false,
      error: 'Errore interno del server durante la verifica del consenso'
    });
  }
}

module.exports = {
  requirePoliticalConsent
};
