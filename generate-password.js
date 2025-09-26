const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔐 FileDrop Password Hash Generator');
console.log('===================================');

rl.question('Enter password to hash: ', (password) => {
  if (!password) {
    console.log('❌ Password cannot be empty');
    rl.close();
    return;
  }
  
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  
  console.log('\n✅ Password hash generated:');
  console.log('===========================');
  console.log(`Password: ${password}`);
  console.log(`Hash:     ${hash}`);
  console.log('\n📝 Add this to your config.json:');
  console.log('================================');
  console.log(`"auth": {`);
  console.log(`  "enabled": true,`);
  console.log(`  "username": "admin",`);
  console.log(`  "passwordHash": "${hash}"`);
  console.log(`}`);
  console.log('\n💡 Keep your password safe!');
  
  rl.close();
});

// Username: admin
// Password: admin123
// Hash: 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
// node generate-password.js