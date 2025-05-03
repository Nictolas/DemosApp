import { createClient } from '@supabase/supabase-js';
import { UserInfo } from '../client/src/types';

// Configurazione client Supabase
const supabaseUrl = 'https://iamzgdykwpnffqhrdfti.supabase.co';
const supabaseKey = '<REDACTED_JWT>';

const supabase = createClient(supabaseUrl, supabaseKey);

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
  }): Promise<{ success: boolean, error?: any, data?: any }> {
    try {
      console.log('Saving user opinions to Supabase for user ID:', utenteId, opinions);
      
      // Verifica se esistono già opinioni per questo utente
      const { data: existingData, error: fetchError } = await supabase
        .from('opinioni')
        .select('*')
        .eq('utente_id', utenteId)
        .single();
      
      let result;
      
      if (existingData) {
        // Aggiorna le opinioni esistenti
        result = await supabase
          .from('opinioni')
          .update(opinions)
          .eq('utente_id', utenteId)
          .select();
        
        console.log('Updated existing opinions for user ID:', utenteId);
      } else {
        // Crea un nuovo record di opinioni
        result = await supabase
          .from('opinioni')
          .insert([{ utente_id: utenteId, ...opinions }])
          .select();
        
        console.log('Created new opinions for user ID:', utenteId);
      }
      
      if (result.error) {
        console.error('Error saving/updating opinions in Supabase:', result.error);
        return { success: false, error: result.error };
      }
      
      console.log('Successfully saved/updated opinions in Supabase:', result.data);
      return { success: true, data: result.data };
    } catch (error) {
      console.error('Exception saving/updating opinions in Supabase:', error);
      return { success: false, error };
    }
  }

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
      const { data, error } = await supabase
        .from('opinioni')
        .select('*')
        .eq('utente_id', utenteId)
        .single();
      
      if (error || !data) {
        console.error('Error getting user opinions from Supabase:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Exception getting user opinions from Supabase:', error);
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
        return [];
      }
      
      return data;
    } catch (error) {
      console.error('Exception getting all opinions from Supabase:', error);
      return [];
    }
  }
}

export default SupabaseService;