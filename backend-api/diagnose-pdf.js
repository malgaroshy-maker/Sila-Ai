
const pdf = require('pdf-parse');
const fs = require('fs');

async function test() {
    console.log('Main type:', typeof pdf);
    console.log('Keys:', Object.keys(pdf));
    if (pdf.default) console.log('Default type:', typeof pdf.default);
    if (pdf.PDFParse) console.log('PDFParse type:', typeof pdf.PDFParse);
    
    // Create a dummy buffer
    const buf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF');
    
    try {
        console.log('Attempting function call on pdf...');
        const res = await pdf(buf);
        console.log('Success with pdf(buf)');
    } catch (e) {
        console.log('Failed pdf(buf):', e.message);
        try {
            console.log('Attempting function call on pdf.PDFParse...');
            const res = await pdf.PDFParse(buf);
            console.log('Success with pdf.PDFParse(buf)');
        } catch (e2) {
            console.log('Failed pdf.PDFParse(buf):', e2.message);
            try {
                console.log('Attempting new pdf.PDFParse(buf)...');
                const res = new pdf.PDFParse(buf);
                console.log('Success with new pdf.PDFParse(buf)');
            } catch (e3) {
                console.log('Failed new pdf.PDFParse(buf):', e3.message);
            }
        }
    }
}
test();
