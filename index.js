const TelegramBot = require('node-telegram-bot-api');
const { google } = require('googleapis');
const http = require('http');
http.createServer((_,r)=>r.end('ok')).listen(process.env.PORT||3000);

const bot = new TelegramBot(process.env.BOT_TOKEN, {polling:true});
const auth = new google.auth.JWT(process.env.GOOGLE_CLIENT_EMAIL,null,process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g,'\n'),['https://www.googleapis.com/auth/spreadsheets']);
const sheets = google.sheets({version:'v4',auth});
const SHEET = process.env.GOOGLE_SHEET_ID;

const CLANS = {
  canis: {name:'🐺 Canis Alliance', starter:'Serigala Abu-abu'},
  felis: {name:'🐱 Felis Dominion', starter:'Kucing Hutan'},
  morphos: {name:'🦎 Morphos Collective', starter:'Tokek Zamrud'},
  equine: {name:'🐴 Equine Ascendancy', starter:'Kuda Mustang'},
  aves: {name:'🦜 Aves Dominion', starter:'Elang Perak'}
};

const get = async () => { try { return (await sheets.spreadsheets.values.get({spreadsheetId:SHEET, range:'Users!A2:E'})).data.values || [] } catch { return [] } };

bot.onText(/\/start/, async m => {
  const users = await get();
  const u = users.find(r => r[0] == m.from.id);
  const clan = u? CLANS[u[4]] : null;
  if (clan) return bot.sendMessage(m.chat.id, `Kamu sudah di ${clan.name}\nKetik /menu`);

  // kalau data rusak, hapus dulu
  if (u &&!clan) {
    // tidak usah hapus manual, langsung timpa pilih ulang
  }
  bot.sendMessage(m.chat.id, '🌍 PILIH KLAN', {
    reply_markup: { inline_keyboard: Object.entries(CLANS).map(([k,v])=>[{text:v.name, callback_data:k}]) }
  });
});

bot.on('callback_query', async q => {
  bot.answerCallbackQuery(q.id);
  const clan = q.data;
  if (!CLANS[clan]) return;

  // buat header kalau belum ada
  try { await sheets.spreadsheets.values.get({spreadsheetId:SHEET, range:'Users!A1'}); }
  catch { await sheets.spreadsheets.values.update({spreadsheetId:SHEET, range:'Users!A1', valueInputOption:'RAW', requestBody:{values:[['userId','name','coins','premium','clan']]}}); }

  await sheets.spreadsheets.values.append({spreadsheetId:SHEET, range:'Users!A:E', valueInputOption:'RAW', requestBody:{values:[[String(q.from.id), q.from.first_name, 1000, 0, clan]]}});

  bot.sendMessage(q.message.chat.id, `✅ Bergabung ${CLANS[clan].name}!\nStarter: ${CLANS[clan].starter}\n+1000 koin`);
});

bot.onText(/\/menu/, async m => {
  const u = (await get()).find(r => r[0] == m.from.id);
  if (!u) return bot.sendMessage(m.chat.id, '/start dulu');
  const clan = CLANS[u[4]] || {name:'?'};
  bot.sendMessage(m.chat.id, `📱 ${clan.name}\n💰 ${u[2]} koin`);
});

console.log('BOT OK');
