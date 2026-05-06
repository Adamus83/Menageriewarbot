const TelegramBot = require('node-telegram-bot-api');
const { google } = require('googleapis');
const http = require('http');

// ===== GLOBAL ERROR CATCHER =====
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('REJECTION:', reason?.message || reason);
});

// ===== CONFIG =====
const PORT = process.env.PORT || 3000;
const URL = process.env.RAILWAY_PUBLIC_DOMAIN 
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` 
  : process.env.URL || `http://localhost:${PORT}`;

// ===== GOOGLE AUTH =====
const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '')
  .replace(/\\n/g, '\n')
  .replace(/"/g, '')
  .trim();

let auth;
try {
  auth = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    privateKey,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  auth.authorize().then(() => console.log('AUTH:OK')).catch(e => console.error('AUTH:FAIL', e.message));
} catch (e) {
  console.error('AUTH INIT ERROR:', e.message);
}

const sheets = google.sheets({ version: 'v4', auth });
const SHEET = process.env.GOOGLE_SHEET_ID;

// ===== BOT SETUP (WEBHOOK MODE) =====
let bot;
try {
  bot = new TelegramBot(process.env.BOT_TOKEN, { 
    webHook: { port: PORT }
  });
  bot.setWebHook(`${URL}/bot`).then(() => {
    console.log(`WEBHOOK SET: ${URL}/bot`);
  }).catch(e => {
    console.error('WEBHOOK ERROR:', e.message);
  });
  console.log('BOT:OK');
} catch (e) {
  console.error('BOT INIT ERROR:', e.message);
}

// ===== CLANS =====
const CLANS = {
  canis: { name: '🐺 Canis Alliance', starter: 'Serigala Abu-abu' },
  felis: { name: '🐱 Felis Dominion', starter: 'Kucing Hutan' },
  morphos: { name: '🦎 Morphos Collective', starter: 'Tokek Zamrud' },
  equine: { name: '🐴 Equine Ascendancy', starter: 'Kuda Mustang' },
  aves: { name: '🦜 Aves Dominion', starter: 'Elang Perak' }
};
const CHANGE_FEE = 500;

// ===== HELPERS =====
const get = async () => {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET,
      range: 'Users!A2:E'
    });
    return res.data.values || [];
  } catch (e) {
    console.error('GET SHEET ERROR:', e.message);
    return [];
  }
};

const findUser = async (userId) => {
  const id = String(userId);
  const users = await get();
  const index = users.findIndex(r => String(r[0]) === id);
  return index === -1 ? null : { rowData: users[index], rowIndex: index };
};

const ensureHeader = async () => {
  try {
    await sheets.spreadsheets.values.get({ spreadsheetId: SHEET, range: 'Users!A1' });
  } catch {
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET,
        range: 'Users!A1',
        valueInputOption: 'RAW',
        requestBody: { values: [['userId', 'name', 'coins', 'premium', 'clan']] }
      });
    } catch (e) {
      console.error('HEADER ERROR:', e.message);
    }
  }
};

const updateUserRow = async (rowIndex, userId, name, coins, premium, clan) => {
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET,
      range: `Users!A${rowIndex + 2}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[String(userId), name, coins, premium, clan]] }
    });
  } catch (e) {
    console.error('UPDATE ERROR:', e.message);
  }
};

const appendUser = async (userId, name, coins, premium, clan) => {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET,
      range: 'Users!A:E',
      valueInputOption: 'RAW',
      requestBody: { values: [[String(userId), name, coins, premium, clan]] }
    });
  } catch (e) {
    console.error('APPEND ERROR:', e.message);
  }
};

const getDisplayName = (from) => from.first_name || from.username || 'Unknown';

// ===== HANDLERS =====
bot.onText(/\/start/, async m => {
  try {
    const user = await findUser(m.from.id);
    const clan = user ? CLANS[user.rowData[4]] : null;
    if (user && clan) {
      return bot.sendMessage(m.chat.id,
        `Kamu sudah di ${clan.name}\n💰 ${user.rowData[2]} koin\n\nKetik /menu\nKetik /ganti (biaya: ${CHANGE_FEE} koin)`
      );
    }
    bot.sendMessage(m.chat.id, '🌍 PILIH KLAN', {
      reply_markup: {
        inline_keyboard: Object.entries(CLANS).map(([k, v]) =>
          [{ text: v.name, callback_data: `join_${k}` }]
        )
      }
    });
  } catch (e) {
    console.error('/start ERROR:', e.message);
  }
});

bot.on('callback_query', async q => {
  try {
    bot.answerCallbackQuery(q.id);
    if (!q.data.startsWith('join_')) return;
    const clan = q.data.replace('join_', '');
    if (!CLANS[clan]) return;

    await ensureHeader();
    const name = getDisplayName(q.from);
    const existing = await findUser(q.from.id);

    if (existing) {
      await updateUserRow(existing.rowIndex, q.from.id, name, 1000, 0, clan);
      if (!CLANS[existing.rowData[4]]) {
        return bot.sendMessage(q.message.chat.id,
          `✅ Bergabung ${CLANS[clan].name}!\nStarter: ${CLANS[clan].starter}\n+1000 koin`
        );
      }
      bot.sendMessage(q.message.chat.id,
        `✅ Pindah ke ${CLANS[clan].name}!\nStarter: ${CLANS[clan].starter}`
      );
      return;
    }

    await appendUser(q.from.id, name, 1000, 0, clan);
    bot.sendMessage(q.message.chat.id,
      `✅ Bergabung ${CLANS[clan].name}!\nStarter: ${CLANS[clan].starter}\n+1000 koin`
    );
  } catch (e) {
    console.error('CALLBACK ERROR:', e.message);
  }
});

bot.onText(/\/menu/, async m => {
  try {
    const user = await findUser(m.from.id);
    if (!user) return bot.sendMessage(m.chat.id, 'Ketik /start dulu');
    const clan = CLANS[user.rowData[4]] || { name: '?' };
    bot.sendMessage(m.chat.id,
      `📱 ${clan.name}\n💰 ${user.rowData[2]} koin\nKetik /ganti (biaya: ${CHANGE_FEE} koin)`
    );
  } catch (e) {
    console.error('/menu ERROR:', e.message);
  }
});

bot.onText(/\/ganti/, async m => {
  try {
    const user = await findUser(m.from.id);
    if (!user) return bot.sendMessage(m.chat.id, 'Ketik /start dulu');
    const coins = parseInt(user.rowData[2]) || 0;
    if (coins < CHANGE_FEE) {
      return bot.sendMessage(m.chat.id,
        `❌ Koin tidak cukup!\nButuh: ${CHANGE_FEE}\nPunya: ${coins}`
      );
    }
    await updateUserRow(user.rowIndex, m.from.id, getDisplayName(m.from), coins - CHANGE_FEE, user.rowData[3], user.rowData[4]);
    bot.sendMessage(m.chat.id,
      `💰 -${CHANGE_FEE} koin!\nSisa: ${coins - CHANGE_FEE}\n\n🌍 PILIH KLAN BARU:`,
      {
        reply_markup: {
          inline_keyboard: Object.entries(CLANS).map(([k, v]) =>
            [{ text: v.name, callback_data: `join_${k}` }]
          )
        }
      }
    );
  } catch (e) {
    console.error('/ganti ERROR:', e.message);
  }
});

console.log('READY');
