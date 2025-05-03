import { createClient } from '@supabase/supabase-js';

// Utilizza le variabili d'ambiente pubbliche (con prefisso VITE_)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://iamzgdykwpnffqhrdfti.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '<REDACTED_JWT>';

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
