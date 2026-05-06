const { Telegraf } = require('telegraf');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const express = require('express');

// ===== ENV =====
const BOT_TOKEN = process.env.BOT_TOKEN;
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const ADMIN_ID = process.env.ADMIN_ID;

if (!BOT_TOKEN || !GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_SHEET_ID) {
  console.error('❌ ENV tidak lengkap');
  process.exit(1);
}

// ===== GOOGLE SHEETS =====
const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID);

async function initSheet() {
  await doc.useServiceAccountAuth({
    client_email: GOOGLE_CLIENT_EMAIL,
    private_key: GOOGLE_PRIVATE_KEY,
  });
  await doc.loadInfo();
  console.log('✅ Google Sheet connected:', doc.title);
}

// ===== BOT =====
const bot = new Telegraf(BOT_TOKEN);

async function getPlayerSheet() {
  await initSheet();
  let sheet = doc.sheetsByTitle['Players'];
  if (!sheet) {
    sheet = await doc.addSheet({ title: 'Players', headerValues: ['id','username','nama','saldo','monsters','joined'] });
  }
  return sheet;
}

bot.start(async (ctx) => {
  const userId = ctx.from.id.toString();
  const sheet = await getPlayerSheet();
  const rows = await sheet.getRows();
  let player = rows.find(r => r.id === userId);
  
  if (!player) {
    await sheet.addRow({
      id: userId,
      username: ctx.from.username || '',
      nama: ctx.from.first_name || '',
      saldo: 0,
      monsters: '',
      joined: new Date().toISOString()
    });
    await ctx.reply(`🎮 Selamat datang di Menagerie Wars, ${ctx.from.first_name}!

Akun kamu sudah dibuat.
Saldo: 0

Ketik /topup untuk isi saldo manual.`);
  } else {
    await ctx.reply(`Welcome back, ${player.nama}!
Saldo: ${player.saldo}`);
  }
});

bot.command('saldo', async (ctx) => {
  const sheet = await getPlayerSheet();
  const rows = await sheet.getRows();
  const player = rows.find(r => r.id === ctx.from.id.toString());
  if (!player) return ctx.reply('Ketik /start dulu');
  await ctx.reply(`💰 Saldo kamu: ${player.saldo}`);
});

bot.command('topup', async (ctx) => {
  const amount = ctx.message.text.split(' ')[1];
  if (!amount) return ctx.reply('Format: /topup 50000');
  
  await ctx.reply(`📝 Permintaan topup Rp${amount} dicatat.

Silakan transfer manual, lalu konfirmasi ke admin.
Admin akan approve dengan /approve ${ctx.from.id} ${amount}`);
  
  if (ADMIN_ID) {
    await bot.telegram.sendMessage(ADMIN_ID, `🔔 TOPUP BARU
Dari: ${ctx.from.first_name} (@${ctx.from.username})
ID: ${ctx.from.id}
Jumlah: Rp${amount}

Approve: /approve ${ctx.from.id} ${amount}`);
  }
});

bot.command('approve', async (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) return;
  const [, userId, amount] = ctx.message.text.split(' ');
  if (!userId || !amount) return ctx.reply('Format: /approve userId jumlah');
  
  const sheet = await getPlayerSheet();
  const rows = await sheet.getRows();
  const player = rows.find(r => r.id === userId);
  if (!player) return ctx.reply('Player tidak ditemukan');
  
  player.saldo = (parseInt(player.saldo) || 0) + parseInt(amount);
  await player.save();
  
  await ctx.reply(`✅ Saldo ${player.nama} ditambah Rp${amount}`);
  await bot.telegram.sendMessage(userId, `✅ Topup Rp${amount} berhasil! Saldo sekarang: ${player.saldo}`);
});

bot.command('help', (ctx) => {
  ctx.reply(`/start - daftar
/saldo - cek saldo
/topup <jumlah> - minta topup
/help - bantuan`);
});

bot.catch((err) => console.error('Bot error:', err));

// ===== HEALTH CHECK FOR RAILWAY =====
const app = express();
app.get('/', (req, res) => res.send('Menagerie Bot is running'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Health check on port ${PORT}`));

// ===== START =====
bot.launch().then(() => console.log('✅ Bot started'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
