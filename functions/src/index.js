const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("./firebase");

// Funzione duplicata eliminata: exports.sendComunicazioneNotification = onDocumentCreated("comunicazioni/{comId}", ...) 