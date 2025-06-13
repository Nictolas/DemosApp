import { FirebaseService } from './firebase-service'; // La nostra classe base
import { db } from './firebase-config';
import { collection, query, where, getDocs, deleteDoc, doc, addDoc, updateDoc, limit } from 'firebase/firestore';

class ComunicazioneService extends FirebaseService {
    public static async saveComunicazione(data: any) { return this._saveDocument('comunicazioni', data); }
    public static async getUltimaComunicazione(userId: string) { /* ... logica ... */ }
    public static async checkDuplicateComunicazione(titolo: string, zona: string) { /* ... logica ... */ }
    // ... e tutti gli altri metodi relativi alle comunicazioni ...
}

export default ComunicazioneService;