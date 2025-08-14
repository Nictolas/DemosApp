const admin = require('firebase-admin');

// Inizializza Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function exploreFirestore() {
  console.log('🔍 Esplorando Firestore...');
  
  try {
    // Lista delle collezioni note
    const knownCollections = [
      'utenti',
      'opinioni',
      'opinioni_proposte',
      'comunicazioni',
      'voti_capo_stato',
      'richieste_premium',
      'admin_notifications',
      'elezioni',
      'iniziative_popolari',
      'voti_iniziative_popolari',
      'ice',
      'voti_ice',
      'referendum_abrogativi',
      'voti_referendum_abrogativi'
    ];
    
    console.log('\n📊 Analisi delle collezioni note:');
    
    for (const collectionName of knownCollections) {
      try {
        const snapshot = await db.collection(collectionName).limit(1).get();
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          const data = doc.data();
          console.log(`\n📁 ${collectionName}:`);
          console.log(`   ID documento: ${doc.id}`);
          console.log(`   Campi: ${Object.keys(data).join(', ')}`);
          console.log(`   Esempio dati:`, JSON.stringify(data, null, 2));
        } else {
          console.log(`\n📁 ${collectionName}: (vuota)`);
        }
      } catch (error) {
        console.log(`\n❌ ${collectionName}: Errore - ${error.message}`);
      }
    }
    
    // Cerca collezioni non note
    console.log('\n🔍 Cercando collezioni non note...');
    const collections = await db.listCollections();
    const unknownCollections = collections.filter(col => !knownCollections.includes(col.id));
    
    if (unknownCollections.length > 0) {
      console.log('\n❓ Collezioni non note trovate:');
      for (const col of unknownCollections) {
        try {
          const snapshot = await col.limit(1).get();
          if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            const data = doc.data();
            console.log(`\n📁 ${col.id}:`);
            console.log(`   ID documento: ${doc.id}`);
            console.log(`   Campi: ${Object.keys(data).join(', ')}`);
            console.log(`   Esempio dati:`, JSON.stringify(data, null, 2));
          }
        } catch (error) {
          console.log(`\n❌ ${col.id}: Errore - ${error.message}`);
        }
      }
    } else {
      console.log('\n✅ Nessuna collezione non nota trovata');
    }
    
    console.log('\n🎉 Esplorazione completata!');
    
  } catch (error) {
    console.error('❌ Errore durante l\'esplorazione:', error);
  } finally {
    process.exit(0);
  }
}

exploreFirestore();
