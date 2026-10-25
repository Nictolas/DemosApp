'use strict';

const { getPoliticalConsentState } = require('./politicalConsentService');

// These permissions apply only to functions that use the viewer's political
// answers to rank/match candidates. They must not restrict reading public
// institutional information, managing GDPR rights, or deleting an account.
async function enforcePoliticalPersonalizationConsent(db, userId, res) {
  if (!userId) {
    res.status(401).json({ success: false, error: 'Autenticazione richiesta' });
    return false;
  }

  try {
    const state = await getPoliticalConsentState(db, userId);
    if (!state.exists) {
      res.status(404).json({ success: false, error: 'Utente non trovato' });
      return false;
    }
    if (!state.granted) {
      res.status(403).json({
        success: false,
        code: 'POLITICAL_CONSENT_REQUIRED',
        error: 'Consenso politico richiesto',
        message: 'Per utilizzare il confronto personalizzato con candidati e rappresentanti serve un consenso esplicito attivo. Puoi comunque consultare le informazioni pubbliche e gestire il tuo account.',
        consent_required: true
      });
      return false;
    }
    return true;
  } catch (_error) {
    // Do not log SQL, user IDs or political values. Consent uncertainty fails closed.
    console.error('Controllo consenso personalizzazione non disponibile');
    res.status(500).json({
      success: false,
      error: 'Impossibile verificare il consenso politico'
    });
    return false;
  }
}

module.exports = { enforcePoliticalPersonalizationConsent };
