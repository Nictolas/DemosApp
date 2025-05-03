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
}

export default SupabaseService;