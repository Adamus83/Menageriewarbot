const { Telegraf } = require('telegraf');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const express = require('express');

// === ENV CHECK ===
const BOT_TOKEN = process.env.BOT_TOKEN;
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const ADMIN_ID = process.env.ADMIN_ID;
const PORT = process.env.PORT || 3000;

console.log('🔍 Checking ENV...');
if (!BOT_TOKEN ||!GOOGLE_CLIENT_EMAIL ||!GOOGLE_PRIVATE_KEY ||!GOOGLE_SHEET_ID) {
  console.error('❌ ENV tidak lengkap. Pastikan BOT_TOKEN, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEET_ID ada');
  process.exit(1);
}
console.log('✅ ENV OK');

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// Health check for Railway
app.get('/', (req, res) => res.send('Menagerie Bot OK'));
app.listen(PORT, () => console.log('🌐 Health check on port', PORT));

// Google Sheets
let doc;
let sheet;

async function initSheet() {
  try {
    const auth = new JWT({
      email: GOOGLE_CLIENT_EMAIL,
      key: GOOGLE_PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, auth);
    await doc.loadInfo();
    sheet = doc.sheetsByIndex[0];
    console.log('✅ Google Sheet connected:', doc.title);
  } catch (e) {
    console.error('❌ GOOGLE SHEET ERROR:', e.message);
    throw e;
  }
}

async function getPlayerSheet(userId) {
  if (!sheet) await initSheet();
  const rows = await sheet.getRows();
  let player = rows.find(r => r.get('user_id') == userId);
  if (!player) {
    player = await sheet.addRow({
      user_id: userId,
      username: '',
      saldo: 0,
      menagerie: '[]',
      last_daily: '',
    });
  }
  return player;
}

// Commands
bot.start(async (ctx) => {
  try {
    const player = await getPlayerSheet(ctx.from.id);
    await player.set('username', ctx.from.username || ctx.from.first_name);
    ctx.reply('🎮 Selamat datang di Menagerie Wars!\n\n/saldo - cek saldo\n/topup <jumlah> - isi saldo\n/daily - klaim harian');
  } catch (e) {
    ctx.reply('❌ Error koneksi Sheet: ' + e.message);
  }
});

bot.command('saldo', async (ctx) => {
  const p = await getPlayerSheet(ctx.from.id);
  ctx.reply(`💰 Saldo kamu: ${p.get('saldo') || 0}`);
});

bot.command('daily', async (ctx) => {
  const p = await getPlayerSheet(ctx.from.id);
  const today = new Date().toDateString();
  if (p.get('last_daily') === today) return ctx.reply('⏳ Daily sudah diklaim hari ini');
  const saldo = Number(p.get('saldo') || 0) + 100;
  await p.set('saldo', saldo);
  await p.set('last_daily', today);
  ctx.reply('✅ Daily +100! Saldo: ' + saldo);
});

bot.command('topup', async (ctx) => {
  const amount = Number(ctx.message.text.split(' ')[1]);
  if (!amount) return ctx.reply('Format: /topup 50000');
  const p = await getPlayerSheet(ctx.from.id);
  await p.set('saldo', Number(p.get('saldo') || 0) + amount);
  ctx.reply(`✅ Topup ${amount} berhasil`);
  if (ADMIN_ID) bot.telegram.sendMessage(ADMIN_ID, `💸 Topup: @${ctx.from.username} +${amount}`);
});

// Error handling
bot.catch((err, ctx) => {
  console.error('❌ TELEGRAM ERROR:', err.message);
});

bot.launch()
 .then(() => console.log('✅ Bot started'))
 .catch(e => {
    console.error('❌ TELEGRAM LAUNCH FAILED:', e.message);
    process.exit(1);
  });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
