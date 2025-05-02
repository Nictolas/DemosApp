import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iamzgdykwpnffqhrdfti.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbXpnZHlrd3BuZmZxaHJkZnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyMTA2NDcsImV4cCI6MjA2MTc4NjY0N30.scE59CajdLZ17oAVle-fp5lK4kUbqa3Tg9EnnsthDjM';

export const supabase = createClient(supabaseUrl, supabaseKey);
