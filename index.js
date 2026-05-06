const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
http.createServer((_,r)=>r.end('OK')).listen(process.env.PORT||3000);

const bot = new TelegramBot(process.env.BOT_TOKEN, {polling:true});

const CLANS = {
  canis: '🐺 Canis Alliance',
  felis: '🐱 Felis Dominion', 
  morphos: '🦎 Morphos Collective',
  equine: '🐴 Equine Ascendancy',
  aves: '🦜 Aves Dominion'
};

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, '🌍 PILIH KLAN (tes)', {
    reply_markup: {
      inline_keyboard: Object.entries(CLANS).map(([k,v]) => [{text: v, callback_data: k}])
    }
  });
});

bot.on('callback_query', (q) => {
  bot.answerCallbackQuery(q.id);
  bot.sendMessage(q.message.chat.id, `✅ Kamu pilih ${CLANS[q.data]}\n\nBot baru sudah jalan!`);
});

console.log('✅ BOT TES JALAN');
