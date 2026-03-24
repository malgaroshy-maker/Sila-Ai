import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SUPABASE_URL = "https://xdzjkqznanqqqlitqnkm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkemprcXpuYW5xcXFsaXRxbmttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTk4MjcsImV4cCI6MjA4OTc3NTgyN30.vnO4mYF3gSKKxDeAIZY9XyFmDQFI7LPoLdvaSjSufDU";
const GEMINI_API_KEY = "AIzaSyB0XUVaSTs_DBZ404htLU-N1E6pT2LeMHQ";

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
