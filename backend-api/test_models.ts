import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = "AIzaSyB0XUVaSTs_DBZ404htLU-N1E6pT2LeMHQ";

async function listModels() {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  
  try {
    console.log('Fetching all available models...');
    // The listModels method might not be in the version of SDK I'm using if it's very old,
    // but typically it is.
    // If it fails, I'll fallback to hardcoded ones.
    
    // Testing specific ones directly again with v1 as well if possible
    const testCases = [
      { model: 'text-embedding-004' },
      { model: 'models/text-embedding-004' },
      { model: 'embedding-001' },
      { model: 'models/embedding-001' }
    ];

    for (const tc of testCases) {
      try {
        const model = genAI.getGenerativeModel({ model: tc.model });
        const res = await model.embedContent("Hello world");
        console.log(`[PASS] ${tc.model} works!`);
      } catch (e: any) {
        console.log(`[FAIL] ${tc.model}: ${e.message}`);
      }
    }

  } catch (e: any) {
    console.error('General error:', e.message);
  }
}

listModels();
