
const { PDFParse } = require('pdf-parse');

async function test() {
    // A more valid-looking minimal PDF
    const buf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 100 700 Td (Hello World) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\n0000000178 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n271\n%%EOF');
    
    try {
        console.log('Initializing PDFParse...');
        const parser = new PDFParse({ data: buf });
        console.log('Calling getText()...');
        const result = await parser.getText();
        console.log('Result text:', result.text);
        console.log('Success!');
    } catch (e) {
        console.log('Failed:', e);
    }
}
test();
