import { createClient } from '@supabase/supabase-js';
export { createClient };

const supabaseUrl = "https://vhkaykhoefsuddhmciex.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoa2F5a2hvZWZzdWRkaG1jaWV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDkwMDgwNSwiZXhwIjoyMDYwNDc2ODA1fQ.kcixtYw_1YyCJslkZ4s0GiiuOKhizBcMChZADmzWgYo";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
