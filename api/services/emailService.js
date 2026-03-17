/**
 * Servizio email DISABILITATO.
 *
 * Il sistema non utilizza più l'invio di email.
 * Manteniamo però la stessa interfaccia pubblica in modo che
 * il resto del codice possa continuare a chiamare queste funzioni
 * senza rompere nulla, ma senza effettuare alcun invio reale.
 */

const buildDisabledResult = (operation) => {
  const message = `Invio email disabilitato (${operation}) - il sistema non usa più le email`;
  console.log(`⚠️ ${message}`);
  return {
    success: false,
    disabled: true,
    operation,
    message
  };
};

/**
 * Invia email di reset password
 */
const sendResetPasswordEmail = async () => {
  return buildDisabledResult('reset-password');
};

/**
 * Invia email di verifica
 */
const sendVerificationEmail = async () => {
  return buildDisabledResult('verification');
};

/**
 * Test della configurazione Resend
 */
const testResend = async () => {
  return buildDisabledResult('test-resend');
};

/**
 * API generica usata da NotificationService.
 * Prima inviava email reali, ora è un no-op.
 */
const sendEmail = async () => {
  return buildDisabledResult('generic-email');
};

module.exports = {
  sendResetPasswordEmail,
  sendVerificationEmail,
  testResend,
  sendEmail
};
