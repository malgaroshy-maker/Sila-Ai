import { generateExceptionalCandidateEmail } from './backend-api/src/email/alert-template';
import * as fs from 'fs';
import * as path from 'path';

const data = {
  candidateName: 'John Doe',
  jobTitle: 'Senior Software Engineer',
  score: 95,
  companyName: 'SILA AI Tech',
  justification: 'The candidate demonstrates expert-level knowledge of NestJS and Supabase. Their recent experience at MidJourney highlights their ability to scale AI infrastructures.',
  strengths: ['NestJS Mastery', 'Supabase Architecture', 'Cloud Deployment'],
  skillsScore: 98,
  culturalFitScore: 92,
  recommendation: 'Exceptional Match',
};

const result = generateExceptionalCandidateEmail(data);

const outputPath = path.join(process.cwd(), 'artifacts', 'preview_alert.html');
fs.writeFileSync(outputPath, result.html);
console.log(`Generated preview at: ${outputPath}`);
