const fs = require('fs');

async function testLib() {
  const lib = require('pdf-parse');
  const buffer = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 120>>stream\nBT /F1 12 Tf 50 750 Td\n(01 ENE AMAZON.COM.MX 1234.56) Tj\nET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\nxref\n0 6\n0000000000 65535 f\n%%EOF');

  try {
    if (typeof lib.PDFParse === 'function') {
      console.log('PDFParse is a function. Trying to call it as PDFParse(buffer)');
      const instance = new lib.PDFParse(buffer);
      console.log('instance:', Object.keys(instance));
      // wait, pdf.js style parsing? 
      // let's just log what it is
    }
  } catch (e) {
    console.error('ERROR:', e.message);
  }
}
testLib();
