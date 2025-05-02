import { supabase } from '../client/src/lib/supabase';
import { UserInfo } from '../client/src/types';

export const storage = {
  async insertUser(userData: UserInfo) {
    const { data, error } = await supabase
      .from('utenti')
      .insert([userData])
      .select();
    
    if (error) {
      throw error;
    }
    
    return data;
  },
  
  async getAllUsers() {
    const { data, error } = await supabase
      .from('utenti')
      .select('*');
    
    if (error) {
      throw error;
    }
    
    return data;
  },
  
  async getUserById(id: number) {
    const { data, error } = await supabase
      .from('utenti')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      throw error;
    }
    
    return data;
  }
};
