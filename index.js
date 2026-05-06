const TelegramBot = require('node-telegram-bot-api');
const { google } = require('googleapis');
const http = require('http');
http.createServer((_,r)=>r.end('OK')).listen(process.env.PORT||3000);

const bot = new TelegramBot(process.env.BOT_TOKEN, {polling:true});
const auth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g,'\n'),
  ['https://www.googleapis.com/auth/spreadsheets']
);
const sheets = google.sheets({version:'v4',auth});
const SHEET = process.env.GOOGLE_SHEET_ID;

const CLANS = {
  canis: {name:'🐺 Canis Alliance', starter:'Serigala Abu-abu'},
  felis: {name:'🐱 Felis Dominion', starter:'Kucing Hutan'},
  morphos: {name:'🦎 Morphos Collective', starter:'Tokek Zamrud'},
  equine: {name:'🐴 Equine Ascendancy', starter:'Kuda Mustang'},
  aves: {name:'🦜 Aves Dominion', starter:'Elang Perak'}
};

async function get(sheet){ const r=await sheets.spreadsheets.values.get({spreadsheetId:SHEET,range:`${sheet}!A2:Z`}); return r.data.values||[] }
async function findUser(id){ return (await get('Users')).find(r=>r[0]==id) }

bot.onText(/\/start/, async m=>{
  const u = await findUser(String(m.from.id));
  if(u) return bot.sendMessage(m.chat.id, `Kamu sudah di ${CLANS[u[4]].name}\nKetik /menu`);
  bot.sendMessage(m.chat.id, '🌍 PILIH KLAN', {
    reply_markup:{inline_keyboard:Object.entries(CLANS).map(([k,v])=>[{text:v.name,callback_data:'join_'+k}])}
  });
});

bot.on('callback_query', async q=>{
  bot.answerCallbackQuery(q.id);
  if(!q.data.startsWith('join_')) return;
  const clan = q.data.split('_')[1];
  if(await findUser(String(q.from.id))) return;

  // buat sheet kalau belum ada
  try{ await sheets.spreadsheets.values.get({spreadsheetId:SHEET,range:'Users!A1'});}catch{ await sheets.spreadsheets.batchUpdate({spreadsheetId:SHEET,requestBody:{requests:[{addSheet:{properties:{title:'Users'}}}]}}); await sheets.spreadsheets.values.update({spreadsheetId:SHEET,range:'Users!A1',valueInputOption:'RAW',requestBody:{values:[['userId','name','coins','premium','clan']]}})}

  await sheets.spreadsheets.values.append({spreadsheetId:SHEET,range:'Users!A2',valueInputOption:'RAW',requestBody:{values:[[String(q.from.id),q.from.first_name,1000,0,clan]]}});

  bot.sendMessage(q.message.chat.id, `✅ Bergabung ${CLANS[clan].name}!\nStarter: ${CLANS[clan].starter}\n+1000 koin\n\nKetik /menu`);
});

bot.onText(/\/menu/, async m=>{
  const u = await findUser(String(m.from.id));
  if(!u) return bot.sendMessage(m.chat.id,'/start dulu');
  bot.sendMessage(m.chat.id, `📱 MENU\nKlan: ${CLANS[u[4]].name}\n🪙 Koin: ${u[2]}\n\n/saldo /daily /pet`);
});

bot.onText(/\/saldo/, async m=>{
  const u = await findUser(String(m.from.id));
  bot.sendMessage(m.chat.id, u?`💰 ${u[2]} koin`:' /start dulu');
});

bot.onText(/\/daily/, async m=>{
  const users = await get('Users'); const i = users.findIndex(r=>r[0]==String(m.from.id));
  if(i<0) return; const coins = parseInt(users[i][2]||0)+100;
  await sheets.spreadsheets.values.update({spreadsheetId:SHEET,range:`Users!C${i+2}`,valueInputOption:'RAW',requestBody:{values:[[coins]]}});
  bot.sendMessage(m.chat.id,'✅ +100 koin daily!');
});

console.log('✅ MENAGERIE WARS FULL AKTIF');
