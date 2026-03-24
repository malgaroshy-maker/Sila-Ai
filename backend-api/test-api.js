const fs = require('fs');
const path = require('path');

async function testApi() {
  console.log('1. Creating a Job...');
  const jobResponse = await fetch('http://localhost:5000/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Senior Software Engineer',
      description: 'We are looking for a Node.js and React expert.',
      requirements: ['5+ years of experience', 'Next.js', 'NestJS', 'Arabic Speaker']
    })
  });
  
  const job = await jobResponse.json();
  console.log('✅ Job Created:', job.id);

  console.log('\n2. Creating a dummy CV PDF for the test...');
  // We'll just create a very basic text file simulating a CV for the upload test
  const dummyCvPath = path.join(__dirname, 'dummy_cv.txt');
  fs.writeFileSync(dummyCvPath, 'Name: Ahmed Hassan. Experience: 6 years using Node.js, Next.js, and NestJS. Fluent in Arabic and English. GPA: 3.8.');

  console.log('\n3. Uploading CV for AI Analysis (This calls Gemini API)...');
  const formData = new FormData();
  formData.append('jobId', job.id);
  formData.append('name', 'Ahmed Hassan');
  
  // Node fetch FormData needs a Blob
  const fileBlob = new Blob([fs.readFileSync(dummyCvPath)], { type: 'text/plain' });
  formData.append('file', fileBlob, 'dummy_cv.txt');

  const uploadResponse = await fetch('http://localhost:5000/candidates/upload', {
    method: 'POST',
    body: formData
  });

  const result = await uploadResponse.json();
  console.log('✅ Upload Response:');
  console.dir(result, { depth: null, colors: true });
}

testApi().catch(console.error);
