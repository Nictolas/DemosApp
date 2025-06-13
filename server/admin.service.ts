import { FirebaseService } from './firebase-service'; // La nostra classe base
import { db } from './firebase-config';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';

class AdminService extends FirebaseService {
    public static async getPendingUsers() { /* ... logica ... */ }
    public static async approveUser(userId: string) { /* ... logica ... */ }
    public static async rejectUser(userId: string, reason?: string) { /* ... logica ... */ }
    public static async saveProfileClaimRequest(claimData: any) { /* ... logica ... */ }
    // ... e tutti gli altri metodi relativi all'amministrazione ...
}

export default AdminService;