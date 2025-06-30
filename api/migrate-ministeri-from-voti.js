import { adminDb } from './firebase-config.js';

async function migrateMinisteriFromVoti() {
  const votiSnap = await adminDb.collection('voti_ministri').get();
  const categorieSet = new Set();
  votiSnap.forEach(doc => {
    const cat = doc.data().categoria;
    if (cat) categorieSet.add(cat);
  });

  const ministeriSnap = await adminDb.collection('ministeri').get();
  const ministeriEsistenti = new Set();
  ministeriSnap.forEach(doc => {
    const cat = doc.data().categoria;
    if (cat) ministeriEsistenti.add(cat);
  });

  let count = 0;
  for (const categoria of categorieSet) {
    if (!ministeriEsistenti.has(categoria)) {
      await adminDb.collection('ministeri').add({
        nome: categoria.charAt(0).toUpperCase() + categoria.slice(1).replace(/_/g, ' '),
        categoria,
        descrizione: '',
        abilitato: true
      });
      count++;
      console.log('Aggiunto ministero:', categoria);
    }
  }
  console.log(`Aggiunti ${count} nuovi ministeri.`);
}

migrateMinisteriFromVoti().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); }); 