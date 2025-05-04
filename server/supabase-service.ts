import { createClient } from '@supabase/supabase-js';

// Definizione del tipo per le opinioni degli utenti
export interface UserOpinions {
  energia_nucleare?: string;
  sperimentazione_animale?: string;
  legalizzazione_canapa?: string;
  caccia?: string;
  unione_europea?: string;
  utente_id?: string; // Aggiunto per supportare il tracking dell'utente
  [key: string]: string | undefined; // Per consentire l'indice di stringa
}

// Inizializza il client Supabase con le credenziali dell'ambiente
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Variabili per i client Supabase
let supabase: any = null;
let supabaseAdmin: any = null;

// Crea i client solo se le credenziali sono disponibili
if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Client Supabase standard inizializzato');
  } catch (error) {
    console.error('Errore nella creazione del client Supabase standard:', error);
  }
}

if (supabaseUrl && supabaseAdminKey) {
  try {
    supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);
    console.log('Client Supabase admin inizializzato');
  } catch (error) {
    console.error('Errore nella creazione del client Supabase admin:', error);
  }
}

// Esporta i client
export { supabase, supabaseAdmin };

/**
 * Servizio per interagire con Supabase
 */
class SupabaseService {
  
  // Variabile statica per memorizzare temporaneamente le opinioni in caso di errori
  static tempOpinions: Record<string, UserOpinions> = {};

  /**
   * Recupera un utente dal database tramite email
   */
  static async getUserByEmail(email: string) {
    try {
      if (!supabase && !supabaseAdmin) {
        console.log('Supabase non configurato, impossibile recuperare utente');
        return null;
      }

      const client = supabaseAdmin || supabase;
      
      // Cerca prima nelle informazioni degli utenti
      const { data, error } = await client
        .from('utenti')
        .select('*')
        .eq('email', email)
        .single();
      
      if (error) {
        console.error('Error getting user by email from Supabase:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Exception getting user by email from Supabase:', error);
      return null;
    }
  }

  /**
   * Salva le opinioni dell'utente su Supabase modificando la tabella utenti
   * @returns {Object} Un oggetto con success (boolean), data (array), note (string opzionale) e error (string o null)
   */
  static async saveUserOpinions(utenteId: string, opinions: UserOpinions): Promise<{
    success: boolean;
    data: any[];
    note?: string;
    error: string | null;
  }> {
    try {
      console.log(`Salvando opinioni per utente con ID: ${utenteId}`, opinions);
      
      // Se Supabase non è configurato, salva solo in memoria
      if (!supabase && !supabaseAdmin) {
        console.log('Supabase non configurato, salvando opinioni solo in memoria');
        
        // Salviamo in memoria le opinioni
        SupabaseService.tempOpinions = SupabaseService.tempOpinions || {};
        SupabaseService.tempOpinions[utenteId] = {
          utente_id: utenteId,
          ...opinions
        };
        
        return { 
          success: true, 
          data: [{
            utente_id: utenteId,
            ...opinions
          }],
          note: "I dati sono stati salvati solo in memoria perché Supabase non è configurato",
          error: null
        };
      }
      
      // Scegliamo quale client Supabase usare (admin o regolare)
      const client = supabaseAdmin || supabase;
      const usingAdminClient = !!supabaseAdmin;
      
      console.log(`Usando client Supabase ${usingAdminClient ? 'ADMIN (bypassa RLS)' : 'standard (soggetto a RLS)'}`);
      
      // Identifica il tipo di ID passato e recupera l'UUID dell'utente necessario per Supabase
      let targetUUID = utenteId;
      
      // Se l'ID è numerico, potrebbe essere un ID utente dal database locale
      if (!isNaN(Number(utenteId))) {
        console.log(`L'ID fornito è numerico: ${utenteId}, cerco l'UUID corrispondente`);
        
        // Controlla se esiste un utente con questo ID numerico come user_id
        const { data: userData, error: userError } = await client
          .from('utenti')
          .select('id')
          .eq('user_id', Number(utenteId))
          .single();
        
        if (!userError && userData) {
          targetUUID = userData.id;
          console.log(`Trovato UUID utente: ${targetUUID} per user_id: ${utenteId}`);
        } else {
          console.error(`Nessun utente trovato con user_id ${utenteId}`);
          // Proviamo a capire se è già un UUID (potrebbe essere convertito a numero ma comunque valido)
          try {
            // Tenta di cercarlo direttamente
            const { data: directCheck, error: directError } = await client
              .from('utenti')
              .select('id')
              .eq('id', utenteId)
              .single();
              
            if (!directError && directCheck) {
              targetUUID = utenteId;
              console.log(`L'ID ${utenteId} è valido e corrisponde a un utente esistente`);
            } else {
              console.error(`Errore: Impossibile trovare un utente con ID: ${utenteId}`);
              throw new Error(`Utente con ID ${utenteId} non trovato`);
            }
          } catch (innerError) {
            console.error('Errore durante la verifica dell\'ID:', innerError);
            throw new Error(`Utente con ID ${utenteId} non trovato`);
          }
        }
      } else if (utenteId.includes('@')) {
        // Se è un'email, cerchiamo l'utente corrispondente
        console.log(`Cerco utente con email: ${utenteId}`);
        const { data: userByEmail, error: emailError } = await client
          .from('utenti')
          .select('id')
          .eq('email', utenteId)
          .single();
          
        if (!emailError && userByEmail) {
          targetUUID = userByEmail.id;
          console.log(`Trovato UUID utente: ${targetUUID} per email: ${utenteId}`);
        } else {
          console.error(`Nessun utente trovato con email ${utenteId}:`, emailError);
          throw new Error(`Utente con email ${utenteId} non trovato`);
        }
      }
      // Se non è né un numero né un'email, assumiamo che sia già un UUID
      
      // Prepara i dati per l'aggiornamento (solo i campi delle opinioni)
      const opinionData = {
        energia_nucleare: opinions.energia_nucleare || null,
        sperimentazione_animale: opinions.sperimentazione_animale || null,
        legalizzazione_canapa: opinions.legalizzazione_canapa || null,
        caccia: opinions.caccia || null,
        unione_europea: opinions.unione_europea || null
      };
      
      console.log(`Aggiornando opinioni nella tabella utenti con UUID: ${targetUUID}`, opinionData);
      
      // Esegui l'aggiornamento nella tabella utenti usando l'UUID
      const { data: result, error: updateError } = await client
        .from('utenti')
        .update(opinionData)
        .eq('id', targetUUID)
        .select();
      
      if (updateError) {
        console.error(`Errore nell'aggiornamento delle opinioni in Supabase:`, updateError);
        
        // Verifica se è un errore di formato UUID
        if (updateError.message && updateError.message.includes('invalid input syntax for type uuid')) {
          console.error('Errore di formato UUID. Assicurati di utilizzare un UUID valido.');
          throw new Error('ID utente non valido: richiesto un UUID');
        }
        
        throw updateError;
      }
      
      console.log('Opinioni salvate con successo:', result);
      
      // Se abbiamo dati in memoria temporanea per questo utente, li rimuoviamo
      // visto che ora sono stati salvati nel database
      if (SupabaseService.tempOpinions && SupabaseService.tempOpinions[utenteId]) {
        delete SupabaseService.tempOpinions[utenteId]; // Rimuovi dalla memoria temporanea
      }
      
      return { success: true, data: result || [opinionData], error: null };
    } catch (error: any) {
      console.error('Exception saving opinions in Supabase:', error);
      
      // Salviamo in memoria le opinioni come fallback
      SupabaseService.tempOpinions = SupabaseService.tempOpinions || {};
      SupabaseService.tempOpinions[utenteId] = {
        utente_id: utenteId,
        ...opinions
      };
      
      return { 
        success: false, 
        data: [{
          utente_id: utenteId,
          ...opinions
        }],
        note: "I dati sono stati salvati temporaneamente in memoria a causa di un errore nel database: " + (error.message || 'Errore sconosciuto'),
        error: error.message || 'Errore sconosciuto'
      };
    }
  }

  /**
   * Aggiorna i dati di un utente in Supabase
   * @param email Email dell'utente da aggiornare (usata per trovare l'UUID)
   * @param userData Dati dell'utente da aggiornare
   */
  static async updateUserData(email: string, userData: any) {
    try {
      console.log(`Aggiornamento dati utente per ${email}:`, userData);
      
      if (!supabase && !supabaseAdmin) {
        console.log('Supabase non configurato, salvataggio dati in memoria');
        return { 
          success: true, 
          data: [userData],
          note: "Supabase non è configurato, i dati sono stati salvati solo in memoria",
          error: null
        };
      }

      const client = supabaseAdmin || supabase;
      
      // Prima cerca l'utente per ottenere l'UUID
      console.log(`Cercando utente con email: ${email}`);
      const { data: userFound, error: userError } = await client
        .from('utenti')
        .select('id, email')
        .eq('email', email)
        .single();
      
      if (userError) {
        console.log(`Utente con email ${email} non trovato, tentativo di creazione:`, userError);

        // Se l'utente non esiste, proviamo a inserirlo
        const { data: insertedData, error: insertError } = await client
          .from('utenti')
          .insert({...userData, email: email})
          .select();
        
        if (insertError) {
          console.error('Errore durante la creazione del nuovo utente:', insertError);
          return { 
            success: false, 
            data: null,
            error: insertError.message
          };
        }
        
        console.log('Nuovo utente creato con successo:', insertedData);
        return { 
          success: true, 
          data: insertedData,
          error: null
        };
      }
      
      // Se abbiamo trovato l'utente, aggiorniamo i suoi dati usando l'UUID
      console.log(`Utente trovato, aggiornamento con UUID: ${userFound.id}`);
      const { data: updatedData, error: updateError } = await client
        .from('utenti')
        .update(userData)
        .eq('id', userFound.id)
        .select();
        
      if (updateError) {
        console.error('Errore durante l\'aggiornamento dei dati utente:', updateError);
        return { 
          success: false, 
          data: null,
          error: updateError.message
        };
      }
      
      console.log('Dati utente aggiornati con successo:', updatedData);
      return { 
        success: true, 
        data: updatedData,
        error: null
      };
    } catch (error: any) {
      console.error('Exception updating user data in Supabase:', error);
      return { 
        success: false, 
        data: null,
        error: error.message || 'Unknown error' 
      };
    }
  }

  /**
   * Elimina un utente in Supabase tramite email
   * @returns {Object} Un oggetto con success (boolean) e error (string o undefined)
   */
  static async deleteUserByEmail(email: string): Promise<{
    success: boolean;
    error?: string;
    data?: null; 
  }> {
    try {
      if (!supabase && !supabaseAdmin) {
        console.log('Supabase non configurato, impossibile eliminare dati');
        return { 
          success: false, 
          error: "Supabase non è configurato"
        };
      }

      const client = supabaseAdmin || supabase;
      const { error } = await client
        .from('utenti')
        .delete()
        .eq('email', email);
        
      if (error) {
        console.error('Error deleting user from Supabase:', error);
        return { success: false, error: error.message };
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('Exception deleting user from Supabase:', error);
      return { 
        success: false, 
        error: error.message || 'Unknown error' 
      };
    }
  }

  /**
   * Recupera le opinioni dell'utente da Supabase tramite ID utente
   * direttamente dalla tabella utenti
   */
  static async getUserOpinions(utenteId: string): Promise<UserOpinions | null> {
    try {
      // Prima controlla se abbiamo dei dati in memoria per questo utente
      if (SupabaseService.tempOpinions && SupabaseService.tempOpinions[utenteId]) {
        console.log('Recuperando opinioni dalla memoria temporanea per utenteId:', utenteId);
        return SupabaseService.tempOpinions[utenteId];
      }
      
      // Se Supabase non è configurato, restituiamo un oggetto vuoto
      if (!supabase && !supabaseAdmin) {
        console.log('Supabase non configurato, restituendo oggetto opinioni vuoto');
        return {
          energia_nucleare: '',
          sperimentazione_animale: '',
          legalizzazione_canapa: '',
          caccia: '',
          unione_europea: ''
        };
      }
      
      // Scegliamo quale client Supabase usare (admin o regolare)
      // Il client admin bypassa le policy RLS
      const client = supabaseAdmin || supabase;
      const usingAdminClient = !!supabaseAdmin;
      
      console.log(`Recuperando opinioni con client Supabase ${usingAdminClient ? 'ADMIN (bypassa RLS)' : 'standard (soggetto a RLS)'}`);
      
      // Identifica il tipo di ID passato e recupera l'UUID dell'utente necessario per Supabase
      let targetUUID = utenteId;
      let userFound = false;
      
      // Se l'ID è numerico, potrebbe essere un ID utente dal database locale
      if (!isNaN(Number(utenteId))) {
        console.log(`L'ID fornito è numerico: ${utenteId}, cerco l'UUID corrispondente`);
        
        // Cerchiamo direttamente l'utente nella tabella utenti tramite user_id
        const { data: userByUserId, error: userIdError } = await client
          .from('utenti')
          .select('id')
          .eq('user_id', Number(utenteId))
          .single();
          
        if (!userIdError && userByUserId) {
          targetUUID = userByUserId.id;
          userFound = true;
          console.log(`Trovato UUID utente: ${targetUUID} per user_id: ${utenteId}`);
        } else {
          console.log(`Nessun utente trovato con user_id ${utenteId}`);
        }
      } 
      // Se l'ID è un'email, cerchiamo l'utente corrispondente
      else if (utenteId.includes('@')) {
        console.log(`Cerco utente con email: ${utenteId}`);
        
        // Cerca direttamente nella tabella utenti con l'email
        const { data: userByEmail, error: emailError } = await client
          .from('utenti')
          .select('id')
          .eq('email', utenteId)
          .single();
          
        if (!emailError && userByEmail) {
          targetUUID = userByEmail.id;
          userFound = true;
          console.log(`Trovato UUID utente: ${targetUUID} per email: ${utenteId}`);
        } else {
          console.log(`Nessun utente trovato con email ${utenteId}:`, emailError);
        }
      }
      // Se l'ID non è né numerico né un'email, assumiamo che sia già un UUID
      
      // Se non abbiamo trovato un utente valido, restituisci un oggetto vuoto
      if (!userFound && !utenteId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        console.log(`ID fornito ${utenteId} non è un UUID valido e non è stato possibile trovare l'utente corrispondente`);
        return {
          energia_nucleare: '',
          sperimentazione_animale: '',
          legalizzazione_canapa: '',
          caccia: '',
          unione_europea: ''
        };
      }
      
      // Ora recupera le opinioni dalla tabella utenti usando l'UUID
      console.log(`Recuperando opinioni dalla tabella utenti con UUID = ${targetUUID}`);
      
      const { data, error } = await client
        .from('utenti')
        .select('energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia, unione_europea')
        .eq('id', targetUUID)
        .single();
      
      if (error) {
        console.error('Error getting user opinions from Supabase:', error);
        
        // Verifica il tipo di errore
        if (error.message && error.message.includes('invalid input syntax for type uuid')) {
          console.error('Errore di formato UUID. L\'ID utente deve essere un UUID valido.');
        }
        
        // In caso di errore, restituisci un oggetto vuoto per le opinioni
        return {
          energia_nucleare: '',
          sperimentazione_animale: '',
          legalizzazione_canapa: '',
          caccia: '',
          unione_europea: ''
        };
      }
      
      if (!data) {
        // Se non ci sono dati ma non c'è stato un errore, restituiamo un oggetto vuoto
        // o i dati in memoria, se disponibili
        if (SupabaseService.tempOpinions && SupabaseService.tempOpinions[utenteId]) {
          return SupabaseService.tempOpinions[utenteId];
        }
        
        return {
          energia_nucleare: '',
          sperimentazione_animale: '',
          legalizzazione_canapa: '',
          caccia: '',
          unione_europea: ''
        };
      }
      
      // Se abbiamo recuperato dati da Supabase, aggiorna anche la cache in memoria
      SupabaseService.tempOpinions = SupabaseService.tempOpinions || {};
      SupabaseService.tempOpinions[utenteId] = data;
      
      return data;
    } catch (error) {
      console.error('Exception getting user opinions from Supabase:', error);
      
      // In caso di eccezione, prova a restituire i dati in memoria se disponibili
      if (SupabaseService.tempOpinions && SupabaseService.tempOpinions[utenteId]) {
        return SupabaseService.tempOpinions[utenteId];
      }
      
      // Altrimenti restituisci un oggetto vuoto
      return {
        energia_nucleare: '',
        sperimentazione_animale: '',
        legalizzazione_canapa: '',
        caccia: '',
        unione_europea: ''
      };
    }
  }

  /**
   * Recupera le opinioni di tutti gli utenti
   * @deprecated Utilizzare getAllUsersOpinions al posto di questo metodo
   */
  static async getAllOpinions(): Promise<any[]> {
    return this.getAllUsersOpinions();
  }

  /**
   * Recupera le informazioni di tutti gli utenti con le loro opinioni
   */
  static async getAllUsersOpinions(): Promise<any[]> {
    try {
      // Se Supabase non è configurato, restituiamo solo i dati in memoria (se ce ne sono)
      if (!supabase && !supabaseAdmin) {
        console.log('Supabase non configurato, restituendo solo dati in memoria');
        
        // Se ci sono dati in memoria, restituiscili
        if (SupabaseService.tempOpinions) {
          const opinionArray = Object.values(SupabaseService.tempOpinions);
          return opinionArray;
        }
        
        // Altrimenti, restituisci un array vuoto
        return [];
      }
      
      // Scegliamo quale client Supabase usare (admin o regolare)
      const client = supabaseAdmin || supabase;
      const usingAdminClient = !!supabaseAdmin;
      
      console.log(`Recuperando tutti gli utenti con opinioni con client Supabase ${usingAdminClient ? 'ADMIN (bypassa RLS)' : 'standard (soggetto a RLS)'}`);
      
      // Recupera direttamente dalla tabella utenti includendo i campi delle opinioni
      const { data, error } = await client
        .from('utenti')
        .select('id, nome, cognome, email, ruolo, energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia, unione_europea')
        .order('nome');
      
      if (error || !data) {
        console.error('Error getting all users with opinions from Supabase:', error);
        
        // Se c'è un errore, restituisci i dati memorizzati in tempOpinions
        if (SupabaseService.tempOpinions) {
          // Converti l'oggetto tempOpinions in un array
          const opinionArray = Object.values(SupabaseService.tempOpinions);
          console.log('Using in-memory opinions instead of database:', opinionArray);
          return opinionArray;
        }
        
        return [];
      }
      
      // Filtra i dati per includere solo utenti con almeno un'opinione
      const usersWithOpinions = data.filter((user: {
        energia_nucleare?: string;
        sperimentazione_animale?: string;
        legalizzazione_canapa?: string;
        caccia?: string;
        unione_europea?: string;
      }) => {
        return user.energia_nucleare || user.sperimentazione_animale || 
               user.legalizzazione_canapa || user.caccia || user.unione_europea;
      });
      
      // Combina i dati dal database con quelli in memoria
      // Questo è importante per visualizzare sia i dati permanenti che quelli temporanei
      const dbData = usersWithOpinions || [];
      const memoryData = Object.values(SupabaseService.tempOpinions || {});
      
      // Filtra i dati in memoria per mostrare solo quelli con opinioni
      const filteredMemoryData = memoryData.filter(item => {
        return item.energia_nucleare || item.sperimentazione_animale || 
               item.legalizzazione_canapa || item.caccia || item.unione_europea;
      });
      
      // Crea una mappa per evitare duplicati, usando l'ID utenti come chiave
      const opinionMap = new Map();
      
      // Aggiungi prima i dati dal database
      for (const user of dbData) {
        opinionMap.set(user.id, user);
      }
      
      // Poi aggiungi o sostituisci con i dati in memoria, che hanno priorità perché più recenti
      for (const opinion of filteredMemoryData) {
        if (opinion.id) {
          opinionMap.set(opinion.id, opinion);
        } else if (opinion.utente_id) {
          // Se non c'è un ID ma c'è un utente_id, proviamo a usare quello
          opinionMap.set(opinion.utente_id, opinion);
        }
      }
      
      // Converti la mappa in un array
      const combinedData = Array.from(opinionMap.values());
      
      return combinedData;
    } catch (error) {
      console.error('Exception getting all users with opinions from Supabase:', error);
      
      // In caso di eccezione, prova a restituire i dati in memoria
      if (SupabaseService.tempOpinions) {
        return Object.values(SupabaseService.tempOpinions);
      }
      
      return [];
    }
  }
}

export default SupabaseService;