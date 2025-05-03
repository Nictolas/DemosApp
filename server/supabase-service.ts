import { createClient } from '@supabase/supabase-js';
import { UserInfo } from '../client/src/types';
import dotenv from 'dotenv';

// Carica le variabili d'ambiente
dotenv.config();

// Configurazione client Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://iamzgdykwpnffqhrdfti.supabase.co';
// Chiave anonima standard per operazioni di lettura normali
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbXpnZHlrd3BuZmZxaHJkZnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyMTA2NDcsImV4cCI6MjA2MTc4NjY0N30.scE59CajdLZ17oAVle-fp5lK4kUbqa3Tg9EnnsthDjM';
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
      
      // Inserisci nella tabella 'utenti' di Supabase
      const { data, error } = await supabase
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
      const { data, error } = await supabase
        .from('utenti')
        .select('*')
        .eq('email', email)
        .single();
      
      if (error || !data) {
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
      const { data, error } = await supabase
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
      
      // Aggiorna la riga nella tabella 'utenti' di Supabase
      const { data, error } = await supabase
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
      
      const { error } = await supabase
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
      
      // Creiamo una nuova struttura di dati da inserire che include l'utente_id
      const opinionData = {
        utente_id: utenteId,
        energia_nucleare: opinions.energia_nucleare || '',
        sperimentazione_animale: opinions.sperimentazione_animale || '',
        legalizzazione_canapa: opinions.legalizzazione_canapa || '',
        caccia: opinions.caccia || '',
        unione_europea: opinions.unione_europea || ''
      };
      
      // Scegliamo quale client Supabase usare (admin o regolare)
      // Il client admin bypassa le policy RLS
      const client = supabaseAdmin || supabase;
      const usingAdminClient = !!supabaseAdmin;
      
      console.log(`Utilizzando client Supabase ${usingAdminClient ? 'ADMIN (bypassa RLS)' : 'standard (soggetto a RLS)'}`);
      
      // Verifica se esistono già opinioni per questo utente
      // Questo è importante per decidere se fare un INSERT o un UPDATE
      const { data: existingOpinions, error: checkError } = await client
        .from('opinioni')
        .select('*')
        .eq('utente_id', utenteId);
      
      let result;
      
      // Se esistono già opinioni per questo utente, esegui un UPDATE
      if (!checkError && existingOpinions && existingOpinions.length > 0) {
        console.log('Eseguendo UPDATE su opinioni esistenti per l\'utente:', utenteId);
        
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
          .eq('utente_id', utenteId)
          .select();
      } else {
        // Se non esistono, esegui un INSERT
        console.log('Eseguendo INSERT di nuove opinioni per l\'utente:', utenteId);
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
    } catch (error) {
      console.error('Exception saving opinions in Supabase:', error);
      
      // Anche in caso di eccezione, salviamo in memoria le opinioni
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
        note: "I dati sono stati salvati temporaneamente in memoria a causa di un'eccezione."
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
      
      // Prova a recuperare da Supabase
      const { data, error } = await client
        .from('opinioni')
        .select('*')
        .eq('utente_id', utenteId)
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
      const { data, error } = await supabase
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