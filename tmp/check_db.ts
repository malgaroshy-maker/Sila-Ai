import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../backend-api/.env') });

async function checkSchema() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
  
  const { data, error } = await supabase.rpc('get_table_info', { tname: 'settings' });
  if (error) {
    // Fallback if rpc is not there
    console.log('RPC failed, trying raw query...');
    const { data: cols, error: err2 } = await supabase.from('settings').select('*').limit(1);
    if (err2) console.error('Error fetching settings:', err2);
    else console.log('Settings columns:', Object.keys(cols[0] || {}));
  } else {
    console.log('Table Info:', data);
  }
}

checkSchema();
