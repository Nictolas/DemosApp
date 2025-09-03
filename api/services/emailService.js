const { Resend } = require('resend');

// Inizializzazione Resend con gestione errori
let resend;
try {
  if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
    console.log('✅ Resend configurato correttamente');
  } else {
    console.log('⚠️ RESEND_API_KEY non configurata, servizio email disabilitato');
    resend = null;
  }
} catch (error) {
  console.log('⚠️ Errore nell\'inizializzazione Resend:', error.message);
  resend = null;
}

/**
 * Invia email di reset password
 */
const sendResetPasswordEmail = async (email, resetToken, resetUrl) => {
  try {
    console.log('📧 Tentativo invio email con Resend per:', email);
    
    // Verifica che Resend sia disponibile
    if (!resend) {
      throw new Error('Resend non è configurato (RESEND_API_KEY mancante)');
    }
    
    if (!resend.emails || typeof resend.emails.send !== 'function') {
      throw new Error('resend.emails.send non è una funzione');
    }
    
    const emailData = {
      from: process.env.EMAIL_FROM || 'Demos Community <noreply@demos.community>',
      to: email,
      subject: 'Reset Password - Demos Community',
      html: `
        <!DOCTYPE html>
        <html lang="it">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Password - Demos Community</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <!-- Header con gradiente -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Demos Community</h1>
              <p style="color: #e2e8f0; margin: 10px 0 0 0; font-size: 18px;">Reset della tua password</p>
            </div>
            
            <!-- Contenuto principale -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1a202c; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">Ciao!</h2>
              
              <p style="color: #4a5568; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
                Hai richiesto il reset della tua password per Demos Community.
              </p>
              
              <p style="color: #4a5568; margin: 0 0 30px 0; font-size: 16px; line-height: 1.6;">
                Per procedere, clicca sul pulsante qui sotto:
              </p>
              
              <!-- Pulsante principale -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 16px 32px; 
                          text-decoration: none; 
                          border-radius: 8px; 
                          display: inline-block;
                          font-weight: 600;
                          font-size: 16px;
                          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                          transition: all 0.3s ease;">
                  Reset Password
                </a>
              </div>
              
              <p style="color: #718096; margin: 30px 0 20px 0; font-size: 14px; line-height: 1.5;">
                Oppure copia e incolla questo link nel browser:
              </p>
              
              <div style="background-color: #f7fafc; padding: 15px; border-radius: 6px; border-left: 4px solid #667eea;">
                <p style="color: #4a5568; margin: 0; font-size: 14px; word-break: break-all; font-family: monospace;">
                  ${resetUrl}
                </p>
              </div>
              
              <div style="margin: 30px 0; padding: 20px; background-color: #fef5e7; border-radius: 8px; border-left: 4px solid #ed8936;">
                <p style="color: #744210; margin: 0; font-size: 14px; line-height: 1.5;">
                  ⏰ <strong>Attenzione:</strong> Questo link scadrà tra 1 ora per motivi di sicurezza.
                </p>
              </div>
              
              <div style="margin: 30px 0; padding: 20px; background-color: #fed7d7; border-radius: 8px; border-left: 4px solid #e53e3e;">
                <p style="color: #742a2a; margin: 0; font-size: 14px; line-height: 1.5;">
                  🔒 <strong>Sicurezza:</strong> Se non hai richiesto tu questo reset, puoi ignorare questa email.
                </p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #718096; margin: 0 0 10px 0; font-size: 14px;">
                <strong>DEMOS Community</strong>
              </p>
              <p style="color: #a0aec0; margin: 0; font-size: 12px;">
                Piattaforma di democrazia partecipativa
              </p>
              <p style="color: #a0aec0; margin: 15px 0 0 0; font-size: 11px;">
                Questa email è stata inviata automaticamente, non rispondere.
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };
    
    console.log('📤 Invio email con Resend...');
    const result = await resend.emails.send(emailData);
    
    console.log('✅ Email inviata con successo tramite Resend');
    console.log('📧 Result:', result);
    
    return { success: true, result };
    
  } catch (error) {
    console.error('❌ Errore nell\'invio email con Resend:', error);
    throw error;
  }
};

/**
 * Invia email di verifica
 */
const sendVerificationEmail = async (email, verificationToken, verificationUrl) => {
  try {
    console.log('📧 Tentativo invio email di verifica con Resend per:', email);
    
    // Verifica che Resend sia disponibile
    if (!resend) {
      throw new Error('Resend non è configurato (RESEND_API_KEY mancante)');
    }
    
    if (!resend.emails || typeof resend.emails.send !== 'function') {
      throw new Error('resend.emails.send non è una funzione');
    }
    
    const emailData = {
      from: process.env.EMAIL_FROM || 'Demos Community <noreply@demos.community>',
      to: email,
      subject: 'Conferma la tua email - Demos Community',
      html: `
        <!DOCTYPE html>
        <html lang="it">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Conferma Email - Demos Community</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <!-- Header con gradiente -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Demos Community</h1>
              <p style="color: #e2e8f0; margin: 10px 0 0 0; font-size: 18px;">Benvenuto nella comunità!</p>
            </div>
            
            <!-- Contenuto principale -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1a202c; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">Ciao!</h2>
              
              <p style="color: #4a5568; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
                Grazie per esserti registrato su Demos Community! Per completare la registrazione, devi confermare la tua email.
              </p>
              
              <p style="color: #4a5568; margin: 0 0 30px 0; font-size: 16px; line-height: 1.6;">
                Clicca sul pulsante qui sotto per confermare il tuo account:
              </p>
              
              <!-- Pulsante principale -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 16px 32px; 
                          text-decoration: none; 
                          border-radius: 8px; 
                          display: inline-block;
                          font-weight: 600;
                          font-size: 16px;
                          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                          transition: all 0.3s ease;">
                  Conferma Email
                </a>
              </div>
              
              <p style="color: #718096; margin: 30px 0 20px 0; font-size: 14px; line-height: 1.5;">
                Oppure copia e incolla questo link nel browser:
              </p>
              
              <div style="background-color: #f7fafc; padding: 15px; border-radius: 6px; border-left: 4px solid #667eea;">
                <p style="color: #4a5568; margin: 0; font-size: 14px; word-break: break-all; font-family: monospace;">
                  ${verificationUrl}
                </p>
              </div>
              
              <div style="margin: 30px 0; padding: 20px; background-color: #fef5e7; border-radius: 8px; border-left: 4px solid #ed8936;">
                <p style="color: #744210; margin: 0; font-size: 14px; line-height: 1.5;">
                  ⏰ <strong>Attenzione:</strong> Questo link scadrà tra 24 ore per motivi di sicurezza.
                </p>
              </div>
              
              <div style="margin: 30px 0; padding: 20px; background-color: #fed7d7; border-radius: 8px; border-left: 4px solid #e53e3e;">
                <p style="color: #742a2a; margin: 0; font-size: 14px; line-height: 1.5;">
                  🔒 <strong>Sicurezza:</strong> Se non hai richiesto tu questa registrazione, puoi ignorare questa email.
                </p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #718096; margin: 0 0 10px 0; font-size: 14px;">
                <strong>DEMOS Community</strong>
              </p>
              <p style="color: #a0aec0; margin: 0; font-size: 12px;">
                Piattaforma di democrazia partecipativa
              </p>
              <p style="color: #a0aec0; margin: 15px 0 0 0; font-size: 11px;">
                Questa email è stata inviata automaticamente, non rispondere.
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };
    
    console.log('📤 Invio email di verifica con Resend...');
    const result = await resend.emails.send(emailData);
    
    console.log('✅ Email di verifica inviata con successo tramite Resend');
    console.log('📧 Result:', result);
    
    return { success: true, result };
    
  } catch (error) {
    console.error('❌ Errore nell\'invio email di verifica con Resend:', error);
    throw error;
  }
};

/**
 * Test della configurazione Resend
 */
const testResend = async () => {
  try {
    console.log('🧪 TEST RESEND - Verifica configurazione...');
    
    // Verifica variabili d'ambiente
    const envCheck = {
      RESEND_API_KEY: process.env.RESEND_API_KEY ? 'Configurato' : 'Non configurato',
      EMAIL_FROM: process.env.EMAIL_FROM || 'Non configurato (usa default)',
      NODE_ENV: process.env.NODE_ENV || 'Non configurato',
      FRONTEND_URL: process.env.FRONTEND_URL || 'Non configurato (usa default)'
    };
    
    console.log('🔍 TEST RESEND - Variabili ambiente:', envCheck);
    
    // Verifica istanza Resend
    if (!resend) {
      throw new Error('Istanza Resend non disponibile');
    }
    
    if (!resend.emails || typeof resend.emails.send !== 'function') {
      throw new Error('Metodo resend.emails.send non disponibile');
    }
    
    // Test invio email semplice
    const testEmailData = {
      from: process.env.EMAIL_FROM || 'Demos Community <noreply@demos.community>',
      to: 'nicolasmicheletti90@gmail.com', // Email di test
      subject: 'Test Resend - Demos Community',
      html: `
        <h1>Test Resend</h1>
        <p>Questo è un test per verificare che Resend funzioni correttamente.</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
        <p>Variabili ambiente:</p>
        <ul>
          <li>RESEND_API_KEY: ${envCheck.RESEND_API_KEY}</li>
          <li>EMAIL_FROM: ${envCheck.EMAIL_FROM}</li>
          <li>NODE_ENV: ${envCheck.NODE_ENV}</li>
        </ul>
      `
    };
    
    console.log('📧 TEST RESEND - Tentativo invio email di test...');
    const result = await resend.emails.send(testEmailData);
    
    console.log('✅ TEST RESEND - Email di test inviata con successo:', result);
    
    return {
      success: true,
      message: 'Test Resend completato con successo',
      envCheck,
      result
    };
    
  } catch (error) {
    console.error('❌ TEST RESEND - Errore:', error);
    
    throw error;
  }
};

module.exports = {
  sendResetPasswordEmail,
  sendVerificationEmail,
  testResend
};
