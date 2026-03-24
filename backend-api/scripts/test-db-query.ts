
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function test() {
  const { data, error } = await supabase
    .from('analysis_results')
    .select('*, applications(jobs(title), candidates(name))')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Data Length:', data.length);
    console.log('First Result:', JSON.stringify(data[0], null, 2));
  }
}

test();
