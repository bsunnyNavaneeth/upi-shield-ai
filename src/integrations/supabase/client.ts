import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://msxkvurukpyljcwgttru.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_nXbVp4QMkIVKhtCEkCBE_Q_KiiFXY5F';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
