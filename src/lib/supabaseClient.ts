import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://torwhncifecugoxydwmh.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvcndobmNpZmVjdWdveHlkd21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1OTM3NzgsImV4cCI6MjEwMTE2OTc3OH0.Ymp6C7pTHs2o-w649aadGzViWmtCuXtLVFElKGqSqjA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
