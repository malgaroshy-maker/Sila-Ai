import { ReportsService } from '../src/reports/reports.service';

// Mock dependencies
const mockSupabase = {
  getClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null })
          })
        })
      })
    }),
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: 'http://example.com' } })
      })
    }
  })
};

const mockJobsService = {
  getJob: () => Promise.resolve({ title: 'Test Job', description: 'Desc', requirements: [] })
};

const mockAiService = {
  getSettings: (email: string) => Promise.resolve({
    analysisLanguage: email.includes('en') ? 'EN' : email.includes('bh') ? 'BH' : 'AR'
  })
};

async function test() {
  const service = new ReportsService(mockSupabase as any, mockJobsService as any, mockAiService as any);
  
  // Since templates are private, we'll use a hack to access them for testing
  const serviceWithPrivate = service as any;

  console.log('--- Testing EN (English) ---');
  const enHtml = serviceWithPrivate.buildHtmlTemplate({ title: 'Job', description: 'Desc', requirements: [] }, [], 'EN');
  console.log('Direction:', enHtml.includes('dir="ltr"') ? 'LTR (Correct)' : 'Wrong');
  console.log('Label:', enHtml.includes('Candidates Analysis Report') ? 'English Label (Correct)' : 'Wrong');

  console.log('\n--- Testing AR (Arabic) ---');
  const arHtml = serviceWithPrivate.buildHtmlTemplate({ title: 'Job', description: 'Desc', requirements: [] }, [], 'AR');
  console.log('Direction:', arHtml.includes('dir="rtl"') ? 'RTL (Correct)' : 'Wrong');
  console.log('Label:', arHtml.includes('تقرير تحليل المرشحين') ? 'Arabic Label (Correct)' : 'Wrong');

  console.log('\n--- Testing BH (Bilingual/Choice 2: English Titles) ---');
  const bhHtml = serviceWithPrivate.buildHtmlTemplate({ title: 'Job', description: 'Desc', requirements: [] }, [], 'BH');
  console.log('Direction:', bhHtml.includes('dir="ltr"') ? 'LTR (Correct)' : 'Wrong');
  console.log('Label:', bhHtml.includes('Candidates Analysis Report') ? 'English Label (Correct)' : 'Wrong');
}

test().catch(console.error);
