require('dotenv').config();

const { testEmailService } = require('./api/services/emailService');

async function testEmail() {
  try {
    console.log('🧪 TEST EMAIL SERVICE - Avvio test...');
    
    const result = await testEmailService();
    
    console.log('✅ TEST COMPLETATO CON SUCCESSO!');
    console.log('📧 Risultato:', result);
    
  } catch (error) {
    console.error('❌ TEST FALLITO:', error.message);
    
    if (error.message.includes('Nessun servizio email configurato')) {
      console.log('\n💡 SOLUZIONE:');
      console.log('1. Configura EMAIL_USER e EMAIL_PASSWORD per Gmail SMTP');
      console.log('2. Oppure configura RESEND_API_KEY per Resend');
      console.log('3. Verifica che le variabili d\'ambiente siano impostate correttamente');
    }
  }
}

testEmail();
