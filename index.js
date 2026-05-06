const TelegramBot = require('node-telegram-bot-api');
const { google } = require('googleapis');
const http = require('http');
http.createServer((_,res)=>res.end('ok')).listen(process.env.PORT||3000);

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

const get = async s => { try{return (await sheets.spreadsheets.values.get({spreadsheetId:SHEET,range:`${s}!A2:Z`})).data.values||[]}catch{return[]} };
const find = async id => (await get('Users')).find(r=>r[0]==id);

bot.onText(/\/start/, async m=>{
  const u = await find(String(m.from.id));
  if(u) return bot.sendMessage(m.chat.id, `Kamu di ${CLANS[u[4]].name}`);
  bot.sendMessage(m.chat.id,'PILIH KLAN',{reply_markup:{inline_keyboard:Object.entries(CLANS).map(([k,v])=>[{text:v.name,callback_data:k}])}});
});

bot.on('callback_query', async q=>{
  bot.answerCallbackQuery(q.id);
  const clan = q.data;
  if(!CLANS[clan]) return;
  if(await find(String(q.from.id))) return bot.sendMessage(q.message.chat.id,'Sudah daftar');

  await sheets.spreadsheets.values.append({spreadsheetId:SHEET,range:'Users!A2',valueInputOption:'RAW',requestBody:{values:[[String(q.from.id),q.from.first_name,1000,0,clan]]}}).catch(async()=>{await sheets.spreadsheets.values.update({spreadsheetId:SHEET,range:'Users!A1',valueInputOption:'RAW',requestBody:{values:[['userId','name','coins','premium','clan']]}});});

  bot.sendMessage(q.message.chat.id, `✅ ${CLANS[clan].name}\nDapat ${CLANS[clan].starter} +1000 koin`);
});

bot.onText(/\/saldo/, async m=>{
  const u = await find(String(m.from.id));
  bot.sendMessage(m.chat.id, u?`💰 ${u[2]}`:'ketik /start');
});

console.log('BOT OK');
