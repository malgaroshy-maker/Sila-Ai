
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

async function testPdfParseStructure() {
  try {
    const pdf = require('pdf-parse');
    console.log('Type of require("pdf-parse"):', typeof pdf);
    console.log('Keys:', Object.keys(pdf));
    
    const parseFn = typeof pdf === 'function' ? pdf : pdf.PDFParse;
    console.log('Resolved parseFn type:', typeof parseFn);
    
    if (typeof parseFn === 'function') {
      console.log('✅ Success: Found a valid function to parse PDF');
    } else {
      console.log('❌ Failure: Could not find valid function');
    }
  } catch (err) {
    console.error('Error during test:', err);
  }
}

testPdfParseStructure();
