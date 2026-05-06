// ============================================================
// MENAGERIE WARS - Node.js Full Game (Railway Ready)
// Port from Google Apps Script + existing wallet bot
// ============================================================
const TelegramBot = require('node-telegram-bot-api');
const { google } = require('googleapis');
const http = require('http');

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

// Health check
http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Menagerie Wars Bot OK');
}).listen(PORT, () => console.log(`🌐 Health check on port ${PORT}`));

console.log('🔍 Checking ENV...');
if (!BOT_TOKEN || !SHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
  console.error('❌ Missing ENV variables');
  process.exit(1);
}
console.log('✅ ENV OK');

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const auth = new google.auth.JWT(CLIENT_EMAIL, null, PRIVATE_KEY, ['https://www.googleapis.com/auth/spreadsheets']);
const sheets = google.sheets({ version: 'v4', auth });

const CLANS = {
  canis: { name: '🐺 Canis Alliance', buff: 'Produksi koin +20%', species: ['Serigala Abu-abu','Rubah Api','Anjing Siberian','Coyote Gurun','Jakal Emas'], starter: 'Serigala Abu-abu' },
  felis: { name: '🐱 Felis Dominion', buff: 'Breeding +25% cepat', species: ['Kucing Hutan','Harimau Putih','Panther Hitam','Lynx Salju','Cheetah Emas'], starter: 'Kucing Hutan' },
  morphos: { name: '🦎 Morphos Collective', buff: 'Makanan -30%', species: ['Tokek Zamrud','Ular Python','Bunglon Pelangi','Katak Racun','Salamander Api'], starter: 'Tokek Zamrud' },
  equine: { name: '🐴 Equine Ascendancy', buff: '+5 slot kandang', species: ['Kuda Mustang','Zebra Savana','Keledai Gunung','Rusa Perak','Bison Putih'], starter: 'Kuda Mustang' },
  aves: { name: '🦜 Aves Dominion', buff: 'Booster gratis/hari', species: ['Elang Perak','Macaw Merah','Merak Bulan','Gagak Malam','Hantu Salju'], starter: 'Elang Perak' }
};

async function initSheets() {
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const titles = meta.data.sheets.map(s => s.properties.title);
    const needed = [
      { title: 'Users', headers: ['userId','name','coins','premium','clan','joined','slots'] },
      { title: 'Pets', headers: ['petId','ownerId','species','clan','level','prod','lastFed','breedCount'] },
      { title: 'Market', headers: ['listingId','sellerId','petId','price','status'] },
      { title: 'Clans', headers: ['clanId','name','members'] }
    ];
    for (const n of needed) {
      if (!titles.includes(n.title)) {
        await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests: [{ addSheet: { properties: { title: n.title } } }] } });
        await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `${n.title}!A1:G1`, valueInputOption: 'RAW', requestBody: { values
