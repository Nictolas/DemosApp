import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iamzgdykwpnffqhrdfti.supabase.co';
const supabaseKey = '<REDACTED_JWT>';

export const supabase = createClient(supabaseUrl, supabaseKey);
