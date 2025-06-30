import { db } from './firebase-config.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

const COLLECTION = 'ministeri';

export async function getAllMinisteri() {
  const snapshot = await getDocs(collection(db, COLLECTION));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addMinistero(data) {
  const ref = await addDoc(collection(db, COLLECTION), data);
  return { id: ref.id };
}

export async function updateMinistero(id, data) {
  await updateDoc(doc(db, COLLECTION, id), data);
  return { id };
}

export async function deleteMinistero(id) {
  await deleteDoc(doc(db, COLLECTION, id));
  return { id };
} 