import { FirebaseService } from './firebase-service'; // La nostra classe base
import { db } from './firebase-config';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';

class ElezioneService extends FirebaseService {
    public static async createElezione(data: any) { return this._saveDocument('elezioni', data); }
    public static async getAllElezioni() { /* ... logica ... */ }
    public static async getElezioneById(id: string) { /* ... logica ... */ }
    // ... e tutti gli altri metodi relativi alle elezioni ...
}

export default ElezioneService;