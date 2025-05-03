import { createClient } from '@supabase/supabase-js';

// Utilizza le variabili d'ambiente pubbliche (con prefisso VITE_)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://iamzgdykwpnffqhrdfti.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbXpnZHlrd3BuZmZxaHJkZnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyMTA2NDcsImV4cCI6MjA2MTc4NjY0N30.scE59CajdLZ17oAVle-fp5lK4kUbqa3Tg9EnnsthDjM';

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Verifica se l'utente è autenticato in Supabase
 * Questo è indipendente dall'autenticazione della sessione Express
 */
export async function checkSupabaseAuth(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error("Errore verifica autenticazione Supabase:", error);
      return false;
    }

    return !!data.session;
  } catch (error) {
    console.error("Errore verifica autenticazione Supabase:", error);
    return false;
  }
}
