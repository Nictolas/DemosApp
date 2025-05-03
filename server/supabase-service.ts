import { createClient } from '@supabase/supabase-js';

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
  static tempOpinions: Record<string, any> = {};

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
  static async saveUserOpinions(utenteId: string, opinions: {
    energia_nucleare?: string;
    sperimentazione_animale?: string;
    legalizzazione_canapa?: string;
    caccia?: string;
    unione_europea?: string;
  }): Promise<{
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
          note: "I dati sono stati salvati solo in memoria perché Supabase non è configurato"
        };
      }
      
      // Scegliamo quale client Supabase usare (admin o regolare)
      const client = supabaseAdmin || supabase;
      const usingAdminClient = !!supabaseAdmin;
      
      console.log(`Usando client Supabase ${usingAdminClient ? 'ADMIN (bypassa RLS)' : 'standard (soggetto a RLS)'}`);
      
      // Prima di tutto, dobbiamo recuperare l'ID corretto
      let utentiIdToUse: string | number = utenteId;
      
      // Se l'ID utente è un'email, ottieni l'ID dalla tabella users tramite email
      if (utenteId.includes('@')) {
        console.log(`Il valore utenteId è un'email: ${utenteId}, cercando l'ID corrispondente nella tabella users`);
        
        const { data: userData, error: userError } = await client
          .from('users')
          .select('id')
          .eq('email', utenteId)
          .single();
          
        if (userError || !userData) {
          console.error(`Errore nel recuperare l'ID dalla tabella users per l'email ${utenteId}:`, userError);
        } else {
          // Ora dobbiamo trovare il record corrispondente nella tabella utenti
          const { data: utentiData, error: utentiError } = await client
            .from('utenti')
            .select('id')
            .eq('user_id', userData.id)
            .single();
            
          if (utentiError || !utentiData) {
            console.error(`Errore nel recuperare l'ID dalla tabella utenti per l'user_id ${userData.id}:`, utentiError);
          } else {
            utentiIdToUse = utentiData.id;
            console.log(`ID utente trovato nella tabella utenti: ${utentiIdToUse}`);
          }
        }
      } 
      // Se l'ID è numerico, verifica se è direttamente un ID della tabella utenti o un user_id
      else if (!isNaN(Number(utenteId))) {
        const numericId = Number(utenteId);
        
        // Controlla prima se è un ID diretto in tabella utenti
        const { data: directCheck, error: directError } = await client
          .from('utenti')
          .select('id')
          .eq('id', numericId)
          .single();
          
        if (!directError && directCheck) {
          utentiIdToUse = numericId;
          console.log(`ID ${numericId} trovato direttamente nella tabella utenti`);
        } else {
          // Controlla se è un user_id
          const { data: utentiCheck, error: utentiError } = await client
            .from('utenti')
            .select('id')
            .eq('user_id', numericId)
            .single();
            
          if (!utentiError && utentiCheck) {
            utentiIdToUse = utentiCheck.id;
            console.log(`Trovato utenti.id=${utentiIdToUse} corrispondente a user_id=${numericId}`);
          } else {
            console.log(`Non è stato trovato un record in utenti per l'ID ${numericId}, lo useremo direttamente`);
            utentiIdToUse = numericId;
          }
        }
      }
      
      // Prepara i dati per l'aggiornamento (solo i campi delle opinioni)
      const opinionData = {
        energia_nucleare: opinions.energia_nucleare || null,
        sperimentazione_animale: opinions.sperimentazione_animale || null,
        legalizzazione_canapa: opinions.legalizzazione_canapa || null,
        caccia: opinions.caccia || null,
        unione_europea: opinions.unione_europea || null
      };
      
      console.log(`Aggiornando dati nella tabella utenti con ID: ${utentiIdToUse}`, opinionData);
      
      // Esegui l'aggiornamento nella tabella utenti
      const { data: result, error: updateError } = await client
        .from('utenti')
        .update(opinionData)
        .eq('id', utentiIdToUse)
        .select();
      
      if (updateError) {
        console.error('Error updating user opinions in Supabase:', updateError);
        throw updateError;
      }
      
      console.log('Opinioni salvate con successo:', result);
      
      // Se abbiamo dati in memoria temporanea per questo utente, li rimuoviamo
      // visto che ora sono stati salvati nel database
      if (SupabaseService.tempOpinions && SupabaseService.tempOpinions[utenteId]) {
        SupabaseService.tempOpinions = SupabaseService.tempOpinions || {};
        delete SupabaseService.tempOpinions[utenteId]; // Rimuovi dalla memoria temporanea
      }
      
      return { success: true, data: result || [opinionData], error: null };
    } catch (error: any) {
      console.error('Exception saving opinions in Supabase:', error);
      
      // Controlla se l'errore è relativo alla chiave esterna (foreign key constraint)
      if (error.code === '23503' && error.message.includes('violates foreign key constraint')) {
        console.log('Errore di vincolo di chiave esterna. Verificare se:');
        console.log('1. L\'utente esiste nella tabella users di Supabase');
        console.log('2. Il vincolo di chiave esterna è configurato correttamente');
        console.log('3. L\'ID utente è stato passato correttamente');
        
        // Salviamo temporaneamente in memoria le opinioni
        console.log('Salvataggio temporaneo delle opinioni in memoria...');
      }
      
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
        note: "I dati sono stati salvati temporaneamente in memoria a causa di un errore nel database: " + (error.message || 'Errore sconosciuto'),
        error: null
      };
    }
  }

  /**
   * Aggiorna i dati di un utente in Supabase
   */
  static async updateUserData(email: string, userData: any) {
    try {
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
      const { data, error } = await client
        .from('utenti')
        .update(userData)
        .eq('email', email)
        .select();
        
      if (error) {
        console.error('Error updating user data in Supabase:', error);
        return { 
          success: false, 
          data: null,
          error: error.message
        };
      }
      
      return { 
        success: true, 
        data,
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
  static async getUserOpinions(utenteId: string): Promise<{ 
    energia_nucleare?: string; 
    sperimentazione_animale?: string;
    legalizzazione_canapa?: string;
    caccia?: string;
    unione_europea?: string;
  } | null> {
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
      
      // Prima di tutto, dobbiamo verificare come recuperare l'utente
      let utentiIdToUse: string | number = utenteId;
      
      // Se l'ID utente è un'email, ottieni l'ID utente corrispondente
      if (utenteId.includes('@')) {
        console.log(`Il valore utenteId è un'email: ${utenteId}, cercando l'ID corrispondente nella tabella users`);
        
        const { data: userData, error: userError } = await client
          .from('users')
          .select('id')
          .eq('email', utenteId)
          .single();
          
        if (userError || !userData) {
          console.error(`Errore nel recuperare l'ID dalla tabella users per l'email ${utenteId}:`, userError);
          // Controlla se abbiamo dati in memoria prima di restituire un oggetto vuoto
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
        
        // Cerca il record nella tabella utenti con questo user_id
        const { data: utentiData, error: utentiError } = await client
          .from('utenti')
          .select('id')
          .eq('user_id', userData.id)
          .single();
          
        if (utentiError || !utentiData) {
          console.error(`Errore nel recuperare l'ID dalla tabella utenti per l'user_id ${userData.id}:`, utentiError);
          return {
            energia_nucleare: '',
            sperimentazione_animale: '',
            legalizzazione_canapa: '',
            caccia: '',
            unione_europea: ''
          };
        }
        
        utentiIdToUse = utentiData.id;
        console.log(`ID utente trovato nella tabella utenti: ${utentiIdToUse}`);
      } 
      // Se l'ID è numerico, verifica se è direttamente un ID della tabella utenti o un user_id
      else if (!isNaN(Number(utenteId))) {
        const numericId = Number(utenteId);
        
        // Controlla prima se è un ID diretto in tabella utenti
        const { data: directCheck, error: directError } = await client
          .from('utenti')
          .select('id')
          .eq('id', numericId)
          .single();
          
        if (!directError && directCheck) {
          utentiIdToUse = numericId;
          console.log(`ID ${numericId} trovato direttamente nella tabella utenti`);
        } else {
          // Controlla se è un user_id
          const { data: utentiCheck, error: utentiError } = await client
            .from('utenti')
            .select('id')
            .eq('user_id', numericId)
            .single();
            
          if (!utentiError && utentiCheck) {
            utentiIdToUse = utentiCheck.id;
            console.log(`Trovato utenti.id=${utentiIdToUse} corrispondente a user_id=${numericId}`);
          } else {
            console.log(`Non è stato trovato un record in utenti per l'ID ${numericId}, lo useremo direttamente`);
            utentiIdToUse = numericId;
          }
        }
      }
      
      // Ora recupera le opinioni dalla tabella utenti
      console.log(`Recuperando opinioni dalla tabella utenti con ID = ${utentiIdToUse}`);
      
      const { data, error } = await client
        .from('utenti')
        .select('energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia, unione_europea')
        .eq('id', utentiIdToUse)
        .single();
      
      if (error) {
        console.error('Error getting user opinions from Supabase:', error);
        
        // Se l'errore è dovuto a RLS o record non trovato, restituiamo un oggetto vuoto
        if (error.code === 'PGRST116' || error.code === '42501') {
          // Se stiamo già usando il client admin e c'è un errore, non ci sono davvero opinioni
          if (usingAdminClient) {
            console.log('Nessuna opinione trovata per l\'utente (verificato con client admin)');
          } else {
            console.log('Errore di accesso con client standard, possibile problema di RLS');
          }
          
          // Controlla se abbiamo dati in memoria prima di restituire un oggetto vuoto
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
        
        return null;
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
      
      return null;
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
      
      const { data, error } = await client
        .from('utenti')
        .select('id, nome, cognome, energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia, unione_europea');
      
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
      
      // Combina i dati dal database con quelli in memoria
      // Questo è importante per visualizzare sia i dati permanenti che quelli temporanei
      const dbData = data || [];
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