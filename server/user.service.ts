            import { db, adminDb } from './firebase-config.js';
            import { collection, doc, getDoc, setDoc, query, where, limit, getDocs } from 'firebase/firestore';
            import type { Query } from 'firebase-admin/firestore';
            import { Utente, UserOpinions } from './types.js';
            import { FirebaseService } from './firebase-service.js';

            class UserService extends FirebaseService {

              public static async saveUserData(userData: Partial<Utente>): Promise<{ success: boolean; data?: any; error?: string }> {
                try {
                  if (!db || !userData.email) {
                    return { success: false, error: "Dati essenziali (email) mancanti." };
                  }
                  const emailId = this.emailToId(userData.email);
                  const userDocRef = doc(db, 'utenti', emailId);
                  const dataToSave = { ...userData, id: emailId, updatedAt: new Date().toISOString() };
                  if (!userData.createdAt) {
                    dataToSave.createdAt = new Date().toISOString();
                  }
                  await setDoc(userDocRef, dataToSave, { merge: true });
                  return { success: true, data: dataToSave };
                } catch (error) {
                  return this.handleError(error, 'saveUserData');
                }
              }

              public static async getUserByEmail(email: string): Promise<Utente | null> {
                try {
                  if (!db) return null;
                  const emailId = this.emailToId(email);
                  const userDocRef = doc(db, 'utenti', emailId);
                  const docSnap = await getDoc(userDocRef);
                  if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() } as Utente;
                  const q = query(collection(db, 'utenti'), where('email', '==', email), limit(1));
                  const querySnapshot = await getDocs(q);
                  if (!querySnapshot.empty) return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Utente;
                  return null;
                } catch (error) {
                  this.handleError(error, 'getUserByEmail');
                  return null;
                }
              }

              public static async getAllUsers(): Promise<Utente[]> {
                try {
                  if (!adminDb) {
                    console.error("Admin SDK non inizializzato. Impossibile recuperare tutti gli utenti.");
                    return [];
                  }
                  const snapshot = await adminDb.collection('utenti').get();
                  if (snapshot.empty) return [];
                  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Utente));
                } catch (error) {
                  this.handleError(error, 'getAllUsers');
                  return [];
                }
              }

              public static async getUserOpinions(userEmail: string): Promise<UserOpinions | null> {
                const user = await this.getUserByEmail(userEmail);
                if (!user) return null;
                return {
                  energia_nucleare: user.energia_nucleare,
                  sperimentazione_animale: user.sperimentazione_animale,
                  legalizzazione_canapa: user.legalizzazione_canapa,
                  caccia: user.caccia,
                  unione_europea: user.unione_europea,
                };
              }

              public static async getCandidati(): Promise<Utente[]> {
                const allUsers = await this.getAllUsers();
                return allUsers.filter(user => 
                  user.ruolo === 'Candidato' || user.ruolo === 'Candidato Politico'
                );
              }

              public static async searchPoliticians(searchTerm: string): Promise<Utente[]> {
                const allUsers = await this.getAllUsers();
                const q = searchTerm.toLowerCase();
                return allUsers.filter(user =>
                  (user.ruolo === 'Politico' || user.ruolo === 'Candidato' || user.ruolo === 'Candidato Politico') &&
                  (`${user.nome} ${user.cognome}`.toLowerCase().includes(q))
                );
              }

              public static async getOpinionDetailStats(opinionField: string, regione?: string): Promise<any> {
                try {
                  const validFields = ["energia_nucleare", "sperimentazione_animale", "legalizzazione_canapa", "caccia", "unione_europea"];
                  if (!opinionField || !validFields.includes(opinionField)) {
                    return { error: "Campo opinione non valido o mancante" };
                  }
                  if (!adminDb) return { error: "Errore di configurazione del server" };

                  const calculateAgeRange = (birthDateString: string): string | undefined => {
                    if (!birthDateString) return undefined;
                    const birthDate = new Date(birthDateString);
                    const age = new Date().getFullYear() - birthDate.getFullYear();
                    if (age >= 18 && age <= 24) return '18-24';
                    if (age >= 25 && age <= 34) return '25-34';
                    if (age >= 35 && age <= 44) return '35-44';
                    if (age >= 45 && age <= 54) return '45-54';
                    if (age >= 55 && age <= 64) return '55-64';
                    if (age >= 65) return '65+';
                    return undefined;
                  };

                  let firestoreQuery: Query = 
                      adminDb.collection('utenti').select(opinionField, 'genere', 'data_nascita', 'regione_residenza');
                  if (regione) {
                    firestoreQuery = firestoreQuery.where('regione_residenza', '==', regione);
                  }
                  const snapshot = await firestoreQuery.get();

                  if (snapshot.empty) return { 
                      genderDistributionByOpinion: {},
                      ageDistributionByOpinion: {} 
                  };

                  const stats = {
                    genderDistributionByOpinion: { favorevole: {}, contrario: {}, astenuto: {} },
                    ageDistributionByOpinion: { favorevole: {}, contrario: {}, astenuto: {} }
                  };

                  snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    const opinion = data[opinionField];
                    const gender = (data.genere || 'Non specificato').toLowerCase();
                    const ageRange = calculateAgeRange(data.data_nascita);

                    if (typeof opinion === 'string') {
                      const normalizedOpinion = opinion.toLowerCase();
                      let targetOpinionGroup: keyof typeof stats.genderDistributionByOpinion | null = null;
                      if (normalizedOpinion === 'favorevole') targetOpinionGroup = 'favorevole';
                      else if (normalizedOpinion === 'contrario') targetOpinionGroup = 'contrario';
                      else if (normalizedOpinion === 'astenuto' || normalizedOpinion === 'indeciso') targetOpinionGroup = 'astenuto';

                      if (targetOpinionGroup) {
                        stats.genderDistributionByOpinion[targetOpinionGroup][gender] = (stats.genderDistributionByOpinion[targetOpinionGroup][gender] || 0) + 1;
                        if (ageRange) {
                          stats.ageDistributionByOpinion[targetOpinionGroup][ageRange] = (stats.ageDistributionByOpinion[targetOpinionGroup][ageRange] || 0) + 1;
                        }
                      }
                    }
                  });
                  return stats;
                } catch (error) {
                  return this.handleError(error, 'getOpinionDetailStats');
                }
              }
            }

            export default UserService;