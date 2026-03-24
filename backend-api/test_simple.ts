import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = "AIzaSyB0XUVaSTs_DBZ404htLU-N1E6pT2LeMHQ";

async function testSimple() {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  try {
    const model = genAI.getGenerativeModel({ model: 'embedding-001' });
    const res = await model.embedContent("test");
    console.log('SUCCESS_EMBEDDING_001');
  } catch (e: any) {
    console.log('FAIL_EMBEDDING_001: ' + e.message);
  }
}

testSimple();
