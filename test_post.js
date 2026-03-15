const http = require('http');

const data = JSON.stringify({
    description: "pagotdc",
    amount: "176.55",
    type: "PAGO_TARJETA",
    accountId: "some_account",
    toAccountId: "another_account",
    categoryId: "",
    date: "2026-03-15"
});

const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/transactions',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Cookie': 'userId=aesparzaco',
        'Content-Length': data.length
    }
}, (res) => {
    let responseData = '';
    res.on('data', chunk => responseData += chunk);
    res.on('end', () => console.log('Status: ' + res.statusCode, '\nBody: ' + responseData));
});

req.on('error', console.error);
req.write(data);
req.end();
