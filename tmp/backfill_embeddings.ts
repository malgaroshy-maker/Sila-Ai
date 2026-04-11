import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SUPABASE_URL = process.env.SUPABASE_URL || "YOUR_SUPABASE_URL";
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

async function backfill() {
  console.log('Fetching candidates...');
  const { data: candidates, error } = await supabase.from('candidates').select('*');
  if (error || !candidates) {
    console.error('Error fetching candidates:', error);
    return;
  }

  console.log(`Found ${candidates.length} candidates. generating embeddings...`);

  for (const candidate of candidates) {
    if (!candidate.cv_text) {
      console.log(`Skipping candidate ${candidate.email} (no CV text)`);
      continue;
    }

    try {
      console.log(`Embedding ${candidate.email}...`);
      const result = await embedModel.embedContent(candidate.cv_text);
      const embedding = result.embedding.values;

      const { error: embedError } = await supabase.from('candidate_embeddings').upsert({
        candidate_id: candidate.id,
        content: candidate.cv_text,
        embedding: embedding
      }, { onConflict: 'candidate_id' });

      if (embedError) {
        console.error(`Error saving embedding for ${candidate.email}:`, embedError.message);
      } else {
        console.log(`✓ Saved embedding for ${candidate.email}`);
      }
    } catch (e: any) {
      console.error(`Failed to embed ${candidate.email}:`, e.message);
    }
  }

  console.log('Backfill complete!');
}

backfill();
