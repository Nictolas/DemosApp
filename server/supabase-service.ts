import { createClient } from '@supabase/supabase-js';
import { UserInfo } from '../client/src/types';
import dotenv from 'dotenv';

// Carica le variabili d'ambiente
dotenv.config();

// Configurazione client Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://iamzgdykwpnffqhrdfti.supabase.co';
// Chiave anonima standard per operazioni di lettura normali
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '<REDACTED_JWT>';
// Chiave di servizio per operazioni amministrative (bypassa RLS)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Client standard per le operazioni normali (con RLS applicato)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client admin con service role key per bypassare RLS quando necessario
const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey) 
  : null;

if (!supabaseServiceKey) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY non impostata. Le operazioni di amministrazione avranno restrizioni RLS.');
} else {
  console.log('SUPABASE_SERVICE_ROLE_KEY configurata correttamente per operazioni admin.');
}

export class SupabaseService {
  /**
   * Salva i dati dell'utente in Supabase
   */
  static async saveUserData(userData: UserInfo & { email: string }): Promise<{ success: boolean, error?: any }> {
    try {
      console.log('Saving user data to Supabase:', userData);
      
      // Scegliamo quale client Supabase usare (admin o regolare)
      const client = supabaseAdmin || supabase;
      const usingAdminClient = !!supabaseAdmin;
      
      console.log(`Salvando dati utente con client Supabase ${usingAdminClient ? 'ADMIN (bypassa RLS)' : 'standard (soggetto a RLS)'}`);
      
      // Inserisci nella tabella 'utenti' di Supabase
      const { data, error } = await client
        .from('utenti')
        .insert([userData])
        .select();
      
      if (error) {
        console.error('Error saving to Supabase:', error);
        return { success: false, error };
      }
      
      console.log('Successfully saved to Supabase:', data);
      return { success: true };
    } catch (error) {
      console.error('Exception saving to Supabase:', error);
      return { success: false, error };
    }
  }

  /**
   * Recupera il profilo utente da Supabase tramite email
   */
  static async getUserByEmail(email: string): Promise<UserInfo | null> {
    try {
      // Scegliamo quale client Supabase usare (admin o regolare)
      // Per query di lettura di base possiamo usare il client standard
      const client = supabase;
      
      const { data, error } = await client
        .from('utenti')
        .select('*')
        .eq('email', email)
        .single();
      
      if (error || !data) {
        // Se c'è un errore con il client standard e abbiamo il client admin disponibile, riproviamo con quello
        if (error && supabaseAdmin) {
          console.log('Tentativo di recupero utente con client admin dopo fallimento con client standard');
          
          const adminResult = await supabaseAdmin
            .from('utenti')
            .select('*')
            .eq('email', email)
            .single();
            
          if (!adminResult.error && adminResult.data) {
            console.log('Recupero utente riuscito con client admin');
            return adminResult.data as UserInfo;
          }
        }
        
        console.error('Error getting user from Supabase:', error);
        return null;
      }
      
      return data as UserInfo;
    } catch (error) {
      console.error('Exception getting user from Supabase:', error);
      return null;
    }
  }
  
  /**
   * Recupera tutti gli utenti da Supabase
   */
  static async getAllUsers(): Promise<UserInfo[]> {
    try {
      // Scegliamo quale client Supabase usare (admin o regolare)
      const client = supabaseAdmin || supabase;
      const usingAdminClient = !!supabaseAdmin;
      
      console.log(`Recuperando tutti gli utenti con client Supabase ${usingAdminClient ? 'ADMIN (bypassa RLS)' : 'standard (soggetto a RLS)'}`);
      
      const { data, error } = await client
        .from('utenti')
        .select('*');
      
      if (error || !data) {
        console.error('Error getting users from Supabase:', error);
        return [];
      }
      
      return data as UserInfo[];
    } catch (error) {
      console.error('Exception getting users from Supabase:', error);
      return [];
    }
  }

  /**
   * Aggiorna i dati dell'utente in Supabase
   */
  static async updateUserData(email: string, userData: Partial<UserInfo>): Promise<{ success: boolean, error?: any, data?: any }> {
    try {
      console.log('Updating user data in Supabase for email:', email, userData);
      
      // Scegliamo quale client Supabase usare (admin o regolare)
      const client = supabaseAdmin || supabase;
      const usingAdminClient = !!supabaseAdmin;
      
      console.log(`Aggiornando utente con client Supabase ${usingAdminClient ? 'ADMIN (bypassa RLS)' : 'standard (soggetto a RLS)'}`);
      
      // Aggiorna la riga nella tabella 'utenti' di Supabase
      const { data, error } = await client
        .from('utenti')
        .update(userData)
        .eq('email', email)
        .select();
      
      if (error) {
        console.error('Error updating user in Supabase:', error);
        return { success: false, error };
      }
      
      console.log('Successfully updated user in Supabase:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Exception updating user in Supabase:', error);
      return { success: false, error };
    }
  }

  /**
   * Elimina un utente da Supabase tramite email
   */
  static async deleteUserByEmail(email: string): Promise<{ success: boolean, error?: any }> {
    try {
      console.log('Deleting user from Supabase with email:', email);
      
      // Per le operazioni di eliminazione, è preferibile usare il client admin
      // per essere sicuri di avere i permessi necessari
      const client = supabaseAdmin || supabase;
      const usingAdminClient = !!supabaseAdmin;
      
      console.log(`Eliminando utente con client Supabase ${usingAdminClient ? 'ADMIN (bypassa RLS)' : 'standard (soggetto a RLS)'}`);
      
      const { error } = await client
        .from('utenti')
        .delete()
        .eq('email', email);
      
      if (error) {
        console.error('Error deleting user from Supabase:', error);
        return { success: false, error };
      }
      
      console.log('User successfully deleted from Supabase');
      return { success: true };
    } catch (error) {
      console.error('Exception deleting user from Supabase:', error);
      return { success: false, error };
    }
  }

  /**
   * Salva le opinioni dell'utente in Supabase
   */
  static async saveUserOpinions(utenteId: string, opinions: {
    energia_nucleare?: string;
    sperimentazione_animale?: string;
    legalizzazione_canapa?: string;
    caccia?: string;
    unione_europea?: string;
  }): Promise<{ success: boolean, error?: any, data?: any, note?: string }> {
    try {
      console.log('Saving user opinions to Supabase for user ID:', utenteId, opinions);
      
      // Prima dobbiamo ottenere l'ID numerico dalla tabella users
      let usersId: number | null = null;
      
      // Scegliamo quale client Supabase usare (admin o regolare)
      // Il client admin bypassa le policy RLS
      let client = supabaseAdmin || supabase;
      let usingAdminClient = !!supabaseAdmin;
      
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
          
          // Memorizza in cache temporanea e restituisci
          SupabaseService.tempOpinions = SupabaseService.tempOpinions || {};
          SupabaseService.tempOpinions[utenteId] = {
            utente_id: utenteId,
            energia_nucleare: opinions.energia_nucleare || '',
            sperimentazione_animale: opinions.sperimentazione_animale || '',
            legalizzazione_canapa: opinions.legalizzazione_canapa || '',
            caccia: opinions.caccia || '',
            unione_europea: opinions.unione_europea || ''
          };
          
          return { 
            success: true, 
            data: [SupabaseService.tempOpinions[utenteId]],
            note: "I dati sono stati salvati temporaneamente in memoria perché l'utente non è stato trovato nella tabella users."
          };
        }
        
        usersId = userData.id;
        console.log(`ID numerico recuperato dalla tabella users per l'email ${utenteId}: ${usersId}`);
      } 
      // Se l'ID sembra essere numerico, usalo direttamente
      else if (!isNaN(Number(utenteId))) {
        usersId = Number(utenteId);
        console.log(`L'ID utente fornito è già numerico: ${usersId}`);
      } 
      // Altrimenti, prova a usarlo così com'è (può essere un UUID)
      else {
        console.log(`Utilizzo l'ID così com'è, assumendo che sia un riferimento diretto: ${utenteId}`);
        usersId = null; // Useremo l'ID originale
      }
      
      // Prepara i dati da inserire, utilizzando l'ID corretto
      const opinionData = {
        utente_id: usersId ? usersId.toString() : utenteId,
        energia_nucleare: opinions.energia_nucleare || '',
        sperimentazione_animale: opinions.sperimentazione_animale || '',
        legalizzazione_canapa: opinions.legalizzazione_canapa || '',
        caccia: opinions.caccia || '',
        unione_europea: opinions.unione_europea || ''
      };
      
      // Utilizziamo lo stesso client che abbiamo inizializzato in precedenza
      console.log(`Utilizzando client Supabase ${usingAdminClient ? 'ADMIN (bypassa RLS)' : 'standard (soggetto a RLS)'}`);
      
      // Verifica se esistono già opinioni per questo utente
      // Questo è importante per decidere se fare un INSERT o un UPDATE
      const { data: existingOpinions, error: checkError } = await client
        .from('opinioni')
        .select('*')
        .eq('utente_id', opinionData.utente_id);
      
      let result;
      
      // Se esistono già opinioni per questo utente, esegui un UPDATE
      if (!checkError && existingOpinions && existingOpinions.length > 0) {
        console.log('Eseguendo UPDATE su opinioni esistenti per l\'utente:', opinionData.utente_id);
        
        // Utilizziamo l'operazione UPDATE, specificando l'utente_id
        result = await client
          .from('opinioni')
          .update({
            energia_nucleare: opinionData.energia_nucleare,
            sperimentazione_animale: opinionData.sperimentazione_animale,
            legalizzazione_canapa: opinionData.legalizzazione_canapa,
            caccia: opinionData.caccia,
            unione_europea: opinionData.unione_europea
          })
          .eq('utente_id', opinionData.utente_id)
          .select();
      } else {
        // Se non esistono, esegui un INSERT
        console.log('Eseguendo INSERT di nuove opinioni per l\'utente:', opinionData.utente_id);
        result = await client
          .from('opinioni')
          .insert([opinionData])
          .select();
      }
      
      // Verifica se l'operazione ha avuto successo
      if (result && result.error) {
        console.error('Error saving opinions in Supabase:', result.error);
        
        // Se il problema è RLS e stiamo già usando il client admin, c'è qualche altro problema
        if (result.error.code === '42501' && usingAdminClient) {
          console.error('Errore anche con client admin. Probabile problema di permessi nel database Supabase.');
          
          // Salvare in memoria come fallback
          SupabaseService.tempOpinions = SupabaseService.tempOpinions || {};
          SupabaseService.tempOpinions[utenteId] = opinionData;
          
          return { 
            success: true, 
            data: [opinionData],
            note: "I dati sono stati salvati temporaneamente in memoria. Errore anche con client admin - controllare le policy del database."
          };
        }
        
        // Se il problema è RLS ma non stiamo usando il client admin (improbabile dato il controllo all'inizio)
        if (result.error.code === '42501' && !usingAdminClient) {
          console.log('Violazione RLS rilevata. Tentativo di approccio alternativo...');
          
          // Proviamo con un'operazione di upsert
          console.log('Tentativo di UPSERT...');
          const upsertResult = await client
            .from('opinioni')
            .upsert([opinionData], {
              onConflict: 'utente_id',
              ignoreDuplicates: false
            })
            .select();
            
          if (!upsertResult.error) {
            console.log('UPSERT riuscito:', upsertResult.data);
            return { success: true, data: upsertResult.data };
          }
          
          // Se anche l'upsert fallisce, salviamo in memoria
          console.log('Anche UPSERT fallito, salvataggio in memoria...');
          SupabaseService.tempOpinions = SupabaseService.tempOpinions || {};
          SupabaseService.tempOpinions[utenteId] = opinionData;
          
          return { 
            success: true, 
            data: [opinionData],
            note: "I dati sono stati salvati temporaneamente in memoria. Assicurati che l'utente abbia i permessi corretti nelle policy RLS."
          };
        }
        
        // Per altri tipi di errori, restituisci l'errore
        return { success: false, error: result.error };
      }
      
      console.log('Successfully saved opinions in Supabase:', result ? result.data : 'No data returned');
      
      // Se l'operazione ha avuto successo, aggiorniamo anche i dati in memoria
      // e rimuoviamo dalla cache temporanea se c'era
      if (result && result.data) {
        SupabaseService.tempOpinions = SupabaseService.tempOpinions || {};
        delete SupabaseService.tempOpinions[utenteId]; // Rimuovi dalla memoria temporanea
      }
      
      return { success: true, data: result ? result.data : [opinionData] };
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
        note: "I dati sono stati salvati temporaneamente in memoria a causa di un errore nel database: " + (error.message || 'Errore sconosciuto')
      };
    }
  }
  
  // Variabile statica per memorizzare temporaneamente le opinioni in caso di errori
  static tempOpinions: Record<string, any> = {};

  /**
   * Recupera le opinioni dell'utente da Supabase tramite ID utente
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
      
      // Scegliamo quale client Supabase usare (admin o regolare)
      // Il client admin bypassa le policy RLS
      const client = supabaseAdmin || supabase;
      const usingAdminClient = !!supabaseAdmin;
      
      console.log(`Recuperando opinioni con client Supabase ${usingAdminClient ? 'ADMIN (bypassa RLS)' : 'standard (soggetto a RLS)'}`);
      
      // Prima di tutto, dobbiamo verificare se l'utente esiste nella tabella "utenti" e ottenere
      // il corrispondente user_id dalla tabella "users", che è quello che ci serve
      let usersId: number | null = null;
      
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
        
        usersId = userData.id;
        console.log(`ID numerico recuperato dalla tabella users per l'email ${utenteId}: ${usersId}`);
      } 
      // Se l'ID sembra essere numerico, usalo direttamente
      else if (!isNaN(Number(utenteId))) {
        usersId = Number(utenteId);
        console.log(`L'ID utente fornito è già numerico: ${usersId}`);
      } 
      // Altrimenti, prova a usarlo così com'è (può essere un UUID)
      else {
        console.log(`Utilizzo l'ID così com'è, assumendo che sia un riferimento diretto: ${utenteId}`);
        // Verifica se l'ID si riferisce a un record nella tabella utenti che ha un user_id
        const { data: utentiData, error: utentiError } = await client
          .from('utenti')
          .select('user_id')
          .eq('id', utenteId)
          .single();
          
        if (!utentiError && utentiData && utentiData.user_id) {
          usersId = utentiData.user_id;
          console.log(`Trovato riferimento a user_id ${usersId} per l'utente con ID ${utenteId}`);
        } else {
          usersId = null; // Useremo l'ID originale
        }
      }
      
      // Ora prova a recuperare da Supabase usando l'ID corretto
      const queryId = usersId ? usersId.toString() : utenteId;
      console.log(`Interrogazione alla tabella opinioni con utente_id = ${queryId}`);
      
      const { data, error } = await client
        .from('opinioni')
        .select('*')
        .eq('utente_id', queryId)
        .single();
      
      if (error) {
        console.error('Error getting user opinions from Supabase:', error);
        
        // Se l'errore è dovuto a RLS o record non trovato, restituiamo un oggetto vuoto
        // che verrà interpretato come "non ci sono ancora opinioni"
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
   */
  static async getAllOpinions(): Promise<any[]> {
    try {
      // Scegliamo quale client Supabase usare (admin o regolare)
      const client = supabaseAdmin || supabase;
      const usingAdminClient = !!supabaseAdmin;
      
      console.log(`Recuperando tutte le opinioni con client Supabase ${usingAdminClient ? 'ADMIN (bypassa RLS)' : 'standard (soggetto a RLS)'}`);
      
      const { data, error } = await client
        .from('opinioni')
        .select('*');
      
      if (error || !data) {
        console.error('Error getting all opinions from Supabase:', error);
        
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
      
      // Crea una mappa per evitare duplicati
      const opinionMap = new Map();
      
      // Aggiungi prima i dati dal database
      for (const opinion of dbData) {
        opinionMap.set(opinion.utente_id, opinion);
      }
      
      // Poi aggiungi o sostituisci con i dati in memoria, che hanno priorità perché più recenti
      for (const opinion of memoryData) {
        opinionMap.set(opinion.utente_id, opinion);
      }
      
      // Converti la mappa in un array
      const combinedData = Array.from(opinionMap.values());
      
      return combinedData;
    } catch (error) {
      console.error('Exception getting all opinions from Supabase:', error);
      
      // In caso di eccezione, prova a restituire i dati in memoria
      if (SupabaseService.tempOpinions) {
        return Object.values(SupabaseService.tempOpinions);
      }
      
      return [];
    }
  }
}

export default SupabaseService;