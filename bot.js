const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

console.log('=== AI CRYPTO BOT BAŞLATILIYOR ===');

// API Key'ler kontrolü
const REQUIRED_ENV = ['BOT_TOKEN', 'GEMINI_API_KEY'];
for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
        console.error(`❌ HATA: ${key} bulunamadı!`);
        process.exit(1);
    }
}

console.log('✅ Tüm API Keyler bulundu');

const bot = new Telegraf(process.env.BOT_TOKEN);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Gemini AI modeli
const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash-exp",
    generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
    }
});

// Crypto fiyat API'si
async function getCryptoPrice(cryptoId) {
    try {
        const response = await axios.get(
            `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=usd,eur,try&include_24hr_change=true&include_market_cap=true`
        );
        return response.data[cryptoId];
    } catch (error) {
        console.error('Crypto API hatası:', error);
        return null;
    }
}

// AI ile analiz yap
async function getAIAnalysis(cryptoName, priceData) {
    try {
        const prompt = `
        Kripto para analizi yap: ${cryptoName}
        
        Mevcut veriler:
        - USD Fiyat: $${priceData.usd}
        - EUR Fiyat: €${priceData.eur}
        - TRY Fiyat: ₺${priceData.try}
        - 24s Değişim: %${priceData.usd_24h_change}
        - Market Cap: $${priceData.usd_market_cap}
        
        Kısa, anlaşılır ve profesyonel bir analiz yap. Teknik analiz, piyasa görünümü ve yatırımcılar için öneriler ekle.
        Maksimum 200 kelime. Türkçe cevap ver.
        `;

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('AI Analiz hatası:', error);
        return '❌ AI analizi şu anda kullanılamıyor.';
    }
}

// Trend coinleri getir
async function getTrendingCoins() {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/search/trending');
        return response.data.coins.slice(0, 10);
    } catch (error) {
        console.error('Trending coins hatası:', error);
        return null;
    }
}

// Ana menü
const mainMenu = Markup.keyboard([
    ['💰 Bitcoin', '🌐 Ethereum', '🚀 Trend Coinler'],
    ['🤖 AI Analiz', '📊 Portfolio', '⭐ Favoriler'],
    ['🔔 Haberler', 'ℹ️ Yardım', '📢 Kanal']
]).resize();

// /start komutu
bot.start((ctx) => {
    const welcomeMessage = `🤖 **AI Crypto Bot'a Hoşgeldiniz!**

✨ **Özellikler:**
• Gerçek zamanlı kripto fiyatları
• Gemini AI destekli analizler
• Trend coin takibi
• Çoklu para birimi desteği
• Otomatik haber güncellemeleri

📊 **Kanalımız:** ${process.env.CHANNEL_USERNAME || '@coinvekupon'}

Aşağıdaki butonlardan birini seçin!`;

    ctx.reply(welcomeMessage, {
        parse_mode: 'Markdown',
        ...mainMenu
    });
});

// Bitcoin komutu
bot.command('bitcoin', async (ctx) => {
    await ctx.sendChatAction('typing');
    
    const btcPrice = await getCryptoPrice('bitcoin');
    if (!btcPrice) {
        return ctx.reply('❌ Bitcoin fiyatı alınamadı.');
    }

    const message = `💰 **Bitcoin (BTC)**
    
💵 **Fiyat:**
- $${btcPrice.usd?.toLocaleString()}
- €${btcPrice.eur?.toLocaleString()}
- ₺${btcPrice.try?.toLocaleString()}

📈 **24s Değişim:** ${btcPrice.usd_24h_change?.toFixed(2)}%
📊 **Market Cap:** $${(btcPrice.usd_market_cap / 1e9).toFixed(1)}B`;

    ctx.reply(message, { parse_mode: 'Markdown' });
});

// Ethereum komutu
bot.command('ethereum', async (ctx) => {
    await ctx.sendChatAction('typing');
    
    const ethPrice = await getCryptoPrice('ethereum');
    if (!ethPrice) {
        return ctx.reply('❌ Ethereum fiyatı alınamadı.');
    }

    const message = `🌐 **Ethereum (ETH)**
    
💵 **Fiyat:**
- $${ethPrice.usd?.toLocaleString()}
- €${ethPrice.eur?.toLocaleString()}
- ₺${ethPrice.try?.toLocaleString()}

📈 **24s Değişim:** ${ethPrice.usd_24h_change?.toFixed(2)}%
📊 **Market Cap:** $${(ethPrice.usd_market_cap / 1e9).toFixed(1)}B`;

    ctx.reply(message, { parse_mode: 'Markdown' });
});

// AI Analiz komutu
bot.command('ai', async (ctx) => {
    const coinName = ctx.message.text.split(' ')[1] || 'bitcoin';
    
    await ctx.sendChatAction('typing');
    const priceData = await getCryptoPrice(coinName);
    
    if (!priceData) {
        return ctx.reply(`❌ ${coinName} fiyat verisi alınamadı.`);
    }

    // AI analizini al
    const analysis = await getAIAnalysis(coinName, priceData);
    
    const message = `🤖 **${coinName.toUpperCase()} AI Analizi**
    
${analysis}

💡 *Analiz Gemini AI tarafından oluşturulmuştur. Yatırım tavsiyesi değildir.*`;

    ctx.reply(message, { parse_mode: 'Markdown' });
});

// Trend coinler
bot.command('trend', async (ctx) => {
    await ctx.sendChatAction('typing');
    
    const trending = await getTrendingCoins();
    if (!trending) {
        return ctx.reply('❌ Trend coinler alınamadı.');
    }

    let message = `🚀 **Trend Coinler (24s)**\n\n`;
    
    for (const coin of trending.slice(0, 5)) {
        const priceData = await getCryptoPrice(coin.item.id);
        if (priceData) {
            message += `• **${coin.item.name} (${coin.item.symbol.toUpperCase()})**\n`;
            message += `  💵 $${priceData.usd?.toLocaleString()} | `;
            message += `📈 ${priceData.usd_24h_change?.toFixed(2)}%\n\n`;
        }
    }

    message += `🔍 Detay için: /ai <coin_adi>`;

    ctx.reply(message, { parse_mode: 'Markdown' });
});

// Özel coin sorgulama
bot.command('price', async (ctx) => {
    const coinName = ctx.message.text.split(' ')[1];
    if (!coinName) {
        return ctx.reply('❌ Örnek: /price solana');
    }

    await ctx.sendChatAction('typing');
    const priceData = await getCryptoPrice(coinName.toLowerCase());
    
    if (!priceData) {
        return ctx.reply(`❌ "${coinName}" bulunamadı.`);
    }

    const message = `🔍 **${coinName.toUpperCase()}**
    
💵 **Fiyat:**
- $${priceData.usd?.toLocaleString()}
- €${priceData.eur?.toLocaleString()}
- ₺${priceData.try?.toLocaleString()}

📈 **24s Değişim:** ${priceData.usd_24h_change?.toFixed(2)}%
📊 **Market Cap:** $${(priceData.usd_market_cap / 1e9).toFixed(1)}B

🤖 AI Analiz için: /ai ${coinName}`;

    ctx.reply(message, { parse_mode: 'Markdown' });
});

// Buton işlemleri
bot.hears('💰 Bitcoin', async (ctx) => {
    await ctx.sendChatAction('typing');
    const btcPrice = await getCryptoPrice('bitcoin');
    if (btcPrice) {
        ctx.reply(
            `💰 Bitcoin: $${btcPrice.usd?.toLocaleString()} | %${btcPrice.usd_24h_change?.toFixed(2)} | 🤖 /ai bitcoin`,
            { parse_mode: 'Markdown' }
        );
    }
});

bot.hears('🌐 Ethereum', async (ctx) => {
    await ctx.sendChatAction('typing');
    const ethPrice = await getCryptoPrice('ethereum');
    if (ethPrice) {
        ctx.reply(
            `🌐 Ethereum: $${ethPrice.usd?.toLocaleString()} | %${ethPrice.usd_24h_change?.toFixed(2)} | 🤖 /ai ethereum`,
            { parse_mode: 'Markdown' }
        );
    }
});

bot.hears('🚀 Trend Coinler', async (ctx) => {
    ctx.sendChatAction('typing');
    const trending = await getTrendingCoins();
    
    if (trending) {
        let quickList = '🚀 **Trend Coinler:**\n';
        trending.slice(0, 3).forEach(coin => {
            quickList += `• ${coin.item.name} (${coin.item.symbol.toUpperCase()})\n`;
        });
        quickList += '\n🔍 Detaylı liste: /trend';
        ctx.reply(quickList, { parse_mode: 'Markdown' });
    }
});

bot.hears('🤖 AI Analiz', (ctx) => {
    ctx.reply(`🤖 **AI Analiz Kullanımı:**
    
/ai bitcoin - Bitcoin analizi
/ai ethereum - Ethereum analizi
/ai solana - Solana analizi

💡 Örnek: /ai bitcoin

📊 AI, son fiyat verileriyle teknik analiz yapacaktır.`);
});

bot.hears('📢 Kanal', (ctx) => {
    ctx.reply(`📢 **Kripto & Vip Sinyal Kanalımız:**
    
${process.env.CHANNEL_USERNAME || 'https://t.me/coinvekupon'}

💎 VIP sinyaller ve özel analizler için takipte kalın!`);
});

// Hata yakalama
bot.catch((err, ctx) => {
    console.error('Bot hatası:', err);
    ctx.reply('❌ Bir hata oluştu. Lütfen daha sonra deneyin.');
});

// Botu başlat
console.log('=== BOT BAŞLATILIYOR ===');
bot.launch()
    .then(() => {
        console.log('✅ AI Crypto Bot başarıyla çalışıyor!');
        console.log('📢 Kanal:', process.env.CHANNEL_USERNAME);
    })
    .catch(error => {
        console.error('❌ Bot başlatılamadı:', error);
        process.exit(1);
    });

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
