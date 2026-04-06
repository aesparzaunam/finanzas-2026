const fs = require('fs');
const path = require('path');

async function runTest() {
  const dummyPdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 120>>stream
BT /F1 12 Tf 50 750 Td
(01 ENE AMAZON.COM.MX 1234.56) Tj 0 -20 Td
(02 ENE UBER MX 89.00) Tj 0 -20 Td
(03 FEB NETFLIX 279.00) Tj
ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f
%%EOF`;

  const pdfPath = path.join(__dirname, 'test-amex-dummy.pdf');
  fs.writeFileSync(pdfPath, dummyPdf);

  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', fs.createReadStream(pdfPath));

  try {
    const fetch = (await import('node-fetch')).default;
    const res = await fetch('http://localhost:3000/api/debug-pdf', {
      method: 'POST',
      body: form
    });
    
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch(e) {
    console.error('Error fetching API:', e.message);
  } finally {
    fs.unlinkSync(pdfPath);
  }
}

runTest();
