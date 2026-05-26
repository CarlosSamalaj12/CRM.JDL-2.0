require('dotenv').config();
const { google } = require('googleapis');

let key = process.env.GOOGLE_PRIVATE_KEY || '';
if (key.startsWith('"') && key.endsWith('"')) {
  key = key.substring(1, key.length - 1);
}
key = key.replace(/\\n/g, '\n');

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: key,
  scopes: ['https://www.googleapis.com/auth/calendar']
});

auth.authorize()
  .then(() => console.log('✅ Autorización Exitosa'))
  .catch(err => console.error('❌ Error de Autorización:', err.message));
