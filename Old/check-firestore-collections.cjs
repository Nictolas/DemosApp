require('dotenv').config();
const admin = require('firebase-admin');

// Configurazione Firestore - usa direttamente il file JSON
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const firestore = admin.firestore();

async function checkFirestoreCollections() {
  try {
    console.log('🔍 DEBUG: ANALISI RACCOLTE FIRESTORE');
    
    // 1. LISTA TUTTE LE RACCOLTE
    const collections = await firestore.listCollections();
    
    console.log('\n📊 RACCOLTE TROVATE:');
    collections.forEach(collection => {
      console.log(`   📂 ${collection.id}`);
    });
    
    // 2. ANALIZZA OGNI RACCOLTA
    for (const collection of collections) {
      console.log(`\n🔍 ANALISI RACCOLTA: ${collection.id}`);
      
      const snapshot = await collection.limit(3).get();
      console.log(`   📊 Totale documenti: ${snapshot.size > 0 ? 'Presente' : 'Vuota'}`);
      
      if (!snapshot.empty) {
        console.log('   📄 Esempi documenti:');
        
        snapshot.docs.forEach((doc, index) => {
          const data = doc.data();
          console.log(`\n      📄 Documento ${index + 1} (ID: ${doc.id}):`);
          
          // Mostra i campi principali
          Object.entries(data).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
              if (value.toDate && typeof value.toDate === 'function') {
                console.log(`         ${key}: ${value.toDate()} (Timestamp)`);
              } else {
                console.log(`         ${key}: [Object] (${Object.keys(value).length} chiavi)`);
              }
            } else {
              const displayValue = String(value).length > 50 ? 
                String(value).substring(0, 50) + '...' : 
                String(value);
              console.log(`         ${key}: ${displayValue}`);
            }
          });
          
          // Evidenzia i campi che sembrano riferimenti
          Object.entries(data).forEach(([key, value]) => {
            if (key.includes('userId') || key.includes('uid') || key.includes('Id')) {
              console.log(`         🔗 RIFERIMENTO: ${key} = ${value}`);
            }
          });
        });
      }
    }
    
    // 3. FOCUS SU VOTI_GRAZIA
    console.log('\n🔍 ANALISI DETTAGLIATA: voti_grazia');
    try {
      const votiGraziaSnapshot = await firestore.collection('voti_grazia').limit(5).get();
      
      if (!votiGraziaSnapshot.empty) {
        console.log(`   📊 Totale voti_grazia: ${votiGraziaSnapshot.size} (campione)`);
        
        votiGraziaSnapshot.docs.forEach((doc, index) => {
          const data = doc.data();
          console.log(`\n   📄 Voto ${index + 1}:`);
          console.log(`      🆔 Document ID: ${doc.id}`);
          console.log(`      👤 userId: ${data.userId || 'N/A'}`);
          console.log(`      🗳️ voto: ${data.voto || 'N/A'}`);
          console.log(`      📅 timestamp: ${data.timestamp ? data.timestamp.toDate() : 'N/A'}`);
          
          // Mostra tutti gli altri campi
          Object.entries(data).forEach(([key, value]) => {
            if (!['userId', 'voto', 'timestamp'].includes(key)) {
              console.log(`      📋 ${key}: ${value}`);
            }
          });
        });
      } else {
        console.log('   ⚠️ Raccolta voti_grazia vuota');
      }
    } catch (error) {
      console.log(`   ❌ Errore accesso voti_grazia: ${error.message}`);
    }
    
    // 4. CONTROLLA CORRISPONDENZE UID
    console.log('\n🔍 CONTROLLO CORRISPONDENZE UID:');
    try {
      const utentiSnapshot = await firestore.collection('utenti').limit(3).get();
      const votiSnapshot = await firestore.collection('voti_grazia').limit(3).get();
      
      if (!utentiSnapshot.empty && !votiSnapshot.empty) {
        console.log('   👥 Esempi UID utenti:');
        utentiSnapshot.docs.forEach(doc => {
          console.log(`      ${doc.id} → ${doc.data().email || 'No email'}`);
        });
        
        console.log('   🗳️ Esempi userId in voti:');
        votiSnapshot.docs.forEach(doc => {
          console.log(`      ${doc.data().userId || 'N/A'}`);
        });
      }
    } catch (error) {
      console.log(`   ❌ Errore controllo corrispondenze: ${error.message}`);
    }
    
    console.log('\n✅ ANALISI COMPLETATA');
    
  } catch (error) {
    console.error('❌ Errore durante analisi:', error);
  }
}

checkFirestoreCollections();
