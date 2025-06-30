// Script di migrazione per normalizzare i nomi dei ministri in voti_ministri
import { db } from './firebase-config.js';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';

function normalizeName(name) {
  return (name || '').trim().toLowerCase();
}

function displayName(name) {
  return (name || '')
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

async function migrateVotiMinistri() {
  const col = collection(db, 'voti_ministri');
  const snapshot = await getDocs(col);
  let count = 0;
  for (const d of snapshot.docs) {
    const data = d.data();
    const nomeRaw = data.nomeMinistro || '';
    const nomeKey = normalizeName(nomeRaw);
    const nomeDisp = displayName(nomeRaw);
    // Aggiorna solo se serve
    if (data.nomeMinistro !== nomeKey || !data.nomeDisplay) {
      await updateDoc(doc(db, 'voti_ministri', d.id), {
        nomeMinistro: nomeKey,
        nomeDisplay: nomeDisp
      });
      count++;
    }
  }
  console.log(`Aggiornati ${count} documenti voti_ministri.`);
}

migrateVotiMinistri().then(() => {
  console.log('Migrazione completata.');
  process.exit(0);
}).catch(e => {
  console.error('Errore nella migrazione:', e);
  process.exit(1);
}); 