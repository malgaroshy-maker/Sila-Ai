
const pdf = require('pdf-parse');
const fs = require('fs');

async function test() {
    const buf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF');
    
    try {
        console.log('Attempting new pdf.PDFParse(buf)...');
        const res = new pdf.PDFParse(buf);
        console.log('Result type:', typeof res);
        console.log('Result keys:', Object.keys(res));
        // If it's a promise, await it
        if (res instanceof Promise || (res && typeof res.then === 'function')) {
            console.log('Awaiting promise...');
            const data = await res;
            console.log('Data keys:', Object.keys(data));
            console.log('Data text snippet:', data.text ? data.text.substring(0, 100) : 'NO TEXT');
        } else {
            console.log('Not a promise. Keys:', Object.keys(res));
        }
    } catch (e) {
        console.log('Failed:', e.message);
    }
}
test();
