const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

console.log('=== 🤖 AI CRYPTO BOT BAŞLATILIYOR ===');

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
            `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=usd,eur,try&include_24hr_change=true&include_market_cap=true`,
            { timeout: 10000 }
        );
        return response.data[cryptoId];
    } catch (error) {
        console.error('Crypto API hatası:', error.message);
        return null;
    }
}

// AI ile analiz yap
async function getAIAnalysis(cryptoName, priceData) {
    try {
        const prompt = `
        Kripto para analizi yap: ${cryptoName}
        
        Mevcut veriler:
        - USD Fiyat: $${priceData.usd?.toLocaleString() || 'N/A'}
        - EUR Fiyat: €${priceData.eur?.toLocaleString() || 'N/A'}
        - TRY Fiyat: ₺${priceData.try?.toLocaleString() || 'N/A'}
        - 24s Değişim: %${priceData.usd_24h_change?.toFixed(2) || 'N/A'}
        - Market Cap: $${(priceData.usd_market_cap / 1e9)?.toFixed(1) || 'N/A'}B
        
        Kısa, anlaşılır ve profesyonel bir analiz yap. Teknik analiz, piyasa görünümü ve yatırımcılar için öneriler ekle.
        Maksimum 200 kelime. Türkçe cevap ver.
        `;

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('AI Analiz hatası:', error.message);
        return '❌ AI analizi şu anda kullanılamıyor. Lütfen daha sonra deneyin.';
    }
}

// Trend coinleri getir
async function getTrendingCoins() {
    try {
        const response = await axios.get(
            'https://api.coingecko.com/api/v3/search/trending',
            { timeout: 10000 }
        );
        return response.data.coins.slice(0, 10);
    } catch (error) {
        console.error('Trending coins hatası:', error.message);
        return null;
    }
}

// Tüm coin listesi
async function searchCrypto(query) {
    try {
        const response = await axios.get(
            `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`,
            { timeout: 10000 }
        );
        return response.data.coins.slice(0, 5);
    } catch (error) {
        console.error('Search hatası:', error.message);
        return null;
    }
}

// Ana menü
const mainMenu = Markup.keyboard([
    ['💰 Bitcoin', '🌐 Ethereum', '🚀 Trend Coinler'],
    ['🤖 AI Analiz', '🔍 Coin Ara', '📊 Market'],
    ['ℹ️ Yardım', '📢 Kanalımız']
]).resize();

// /start komutu
bot.start((ctx) => {
    const welcomeMessage = `🤖 **AI Crypto Bot'a Hoşgeldiniz!**

✨ **Özellikler:**
• 💰 Gerçek zamanlı kripto fiyatları
• 🤖 Gemini AI destekli analizler
• 🚀 Trend coin takibi
• 🌍 USD/EUR/TRY desteği
• 🔍 Detaylı coin arama

📊 **Kanalımız:** ${process.env.CHANNEL_USERNAME || '@coinvekupon'}

**Komutlar:**
/bitcoin - Bitcoin fiyatı
/ethereum - Ethereum fiyatı
/price <coin> - Coin fiyatı
/ai <coin> - AI analizi
/trend - Trend coinler
/search <coin> - Coin ara

Veya aşağıdaki butonları kullanın!`;

    ctx.reply(welcomeMessage, {
        parse_mode: 'Markdown',
        ...mainMenu
    });
});

// Yardım komutu
bot.command('help', (ctx) => {
    ctx.reply(`🤖 **Kullanım Kılavuzu:**

**Temel Komutlar:**
/start - Botu başlat
/help - Yardım menüsü

**Fiyat Sorgulama:**
/bitcoin - Bitcoin fiyatı
/ethereum - Ethereum fiyatı
/price <coin> - Özel coin fiyatı
/trend - Trend coinler

**AI Analiz:**
/ai <coin> - Gemini AI analizi

**Arama:**
/search <coin> - Coin arama

**Örnekler:**
/price solana
/ai bitcoin
/search doge

💎 **Kanal:** ${process.env.CHANNEL_USERNAME || '@coinvekupon'}`, 
    { parse_mode: 'Markdown' });
});

// Bitcoin komutu
bot.command('bitcoin', async (ctx) => {
    await ctx.sendChatAction('typing');
    
    const btcPrice = await getCryptoPrice('bitcoin');
    if (!btcPrice) {
        return ctx.reply('❌ Bitcoin fiyatı alınamadı. Lütfen daha sonra deneyin.');
    }

    const change = btcPrice.usd_24h_change || 0;
    const changeIcon = change >= 0 ? '📈' : '📉';

    const message = `💰 **Bitcoin (BTC)**
    
💵 **Fiyat:**
- $${btcPrice.usd?.toLocaleString() || 'N/A'}
- €${btcPrice.eur?.toLocaleString() || 'N/A'}
- ₺${btcPrice.try?.toLocaleString() || 'N/A'}

${changeIcon} **24s Değişim:** ${change.toFixed(2)}%
📊 **Market Cap:** $${(btcPrice.usd_market_cap / 1e9).toFixed(1)}B

🤖 Detaylı analiz için: /ai bitcoin`;

    ctx.reply(message, { parse_mode: 'Markdown' });
});

// Ethereum komutu
bot.command('ethereum', async (ctx) => {
    await ctx.sendChatAction('typing');
    
    const ethPrice = await getCryptoPrice('ethereum');
    if (!ethPrice) {
        return ctx.reply('❌ Ethereum fiyatı alınamadı. Lütfen daha sonra deneyin.');
    }

    const change = ethPrice.usd_24h_change || 0;
    const changeIcon = change >= 0 ? '📈' : '📉';

    const message = `🌐 **Ethereum (ETH)**
    
💵 **Fiyat:**
- $${ethPrice.usd?.toLocaleString() || 'N/A'}
- €${ethPrice.eur?.toLocaleString() || 'N/A'}
- ₺${ethPrice.try?.toLocaleString() || 'N/A'}

${changeIcon} **24s Değişim:** ${change.toFixed(2)}%
📊 **Market Cap:** $${(ethPrice.usd_market_cap / 1e9).toFixed(1)}B

🤖 Detaylı analiz için: /ai ethereum`;

    ctx.reply(message, { parse_mode: 'Markdown' });
});

// AI Analiz komutu
bot.command('ai', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply('❌ Lütfen bir coin adı girin. Örnek: /ai bitcoin');
    }

    const coinName = args[1];
    await ctx.sendChatAction('typing');

    // Önce coin'in var olup olmadığını kontrol et
    const searchResults = await searchCrypto(coinName);
    if (!searchResults || searchResults.length === 0) {
        return ctx.reply(`❌ "${coinName}" coin'i bulunamadı. Lütfen geçerli bir coin adı girin.`);
    }

    const actualCoinId = searchResults[0].id;
    const priceData = await getCryptoPrice(actualCoinId);
    
    if (!priceData) {
        return ctx.reply(`❌ ${coinName} fiyat verisi alınamadı.`);
    }

    ctx.sendChatAction('typing');
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
        return ctx.reply('❌ Trend coinler alınamadı. Lütfen daha sonra deneyin.');
    }

    let message = `🚀 **Trend Coinler (24s)**\n\n`;
    
    for (const coin of trending.slice(0, 5)) {
        const priceData = await getCryptoPrice(coin.item.id);
        if (priceData) {
            const change = priceData.usd_24h_change || 0;
            const changeIcon = change >= 0 ? '📈' : '📉';
            
            message += `• **${coin.item.name}** (${coin.item.symbol.toUpperCase()})\n`;
            message += `  💵 $${priceData.usd?.toLocaleString() || 'N/A'} ${changeIcon} ${change.toFixed(2)}%\n\n`;
        }
    }

    message += `🔍 Detaylı analiz için: /ai <coin_adi>`;

    ctx.reply(message, { parse_mode: 'Markdown' });
});

// Coin arama
bot.command('search', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply('❌ Lütfen aramak istediğiniz coin adını girin. Örnek: /search bitcoin');
    }

    const query = args.slice(1).join(' ');
    await ctx.sendChatAction('typing');

    const results = await searchCrypto(query);
    if (!results || results.length === 0) {
        return ctx.reply(`❌ "${query}" ile ilgili coin bulunamadı.`);
    }

    let message = `🔍 **Arama Sonuçları: "${query}"**\n\n`;
    
    for (const coin of results.slice(0, 5)) {
        message += `• **${coin.name}** (${coin.symbol.toUpperCase()})\n`;
        message += `  🆔 Kullanım: /price ${coin.id}\n`;
        message += `  🤖 Analiz: /ai ${coin.id}\n\n`;
    }

    message += `💡 Fiyat görmek için: /price <coin_id>`;

    ctx.reply(message, { parse_mode: 'Markdown' });
});

// Özel coin sorgulama
bot.command('price', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply('❌ Örnek: /price bitcoin veya /price solana');
    }

    const coinName = args[1];
    await ctx.sendChatAction('typing');

    // Coin'i ara ve gerçek ID'sini bul
    const searchResults = await searchCrypto(coinName);
    if (!searchResults || searchResults.length === 0) {
        return ctx.reply(`❌ "${coinName}" coin'i bulunamadı. /search ${coinName} komutu ile arama yapın.`);
    }

    const actualCoinId = searchResults[0].id;
    const priceData = await getCryptoPrice(actualCoinId);
    
    if (!priceData) {
        return ctx.reply(`❌ "${coinName}" fiyat verisi alınamadı.`);
    }

    const change = priceData.usd_24h_change || 0;
    const changeIcon = change >= 0 ? '📈' : '📉';

    const message = `🔍 **${searchResults[0].name} (${searchResults[0].symbol.toUpperCase()})**
    
💵 **Fiyat:**
- $${priceData.usd?.toLocaleString() || 'N/A'}
- €${priceData.eur?.toLocaleString() || 'N/A'}
- ₺${priceData.try?.toLocaleString() || 'N/A'}

${changeIcon} **24s Değişim:** ${change.toFixed(2)}%
📊 **Market Cap:** $${(priceData.usd_market_cap / 1e9).toFixed(1)}B

🤖 AI Analiz için: /ai ${coinName}`;

    ctx.reply(message, { parse_mode: 'Markdown' });
});

// Buton işlemleri
bot.hears('💰 Bitcoin', async (ctx) => {
    await ctx.sendChatAction('typing');
    const btcPrice = await getCryptoPrice('bitcoin');
    if (btcPrice) {
        const change = btcPrice.usd_24h_change || 0;
        const changeIcon = change >= 0 ? '📈' : '📉';
        ctx.reply(
            `💰 Bitcoin: $${btcPrice.usd?.toLocaleString()} ${changeIcon} ${change.toFixed(2)}% | 🤖 /ai bitcoin`,
            { parse_mode: 'Markdown' }
        );
    }
});

bot.hears('🌐 Ethereum', async (ctx) => {
    await ctx.sendChatAction('typing');
    const ethPrice = await getCryptoPrice('ethereum');
    if (ethPrice) {
        const change = ethPrice.usd_24h_change || 0;
        const changeIcon = change >= 0 ? '📈' : '📉';
        ctx.reply(
            `🌐 Ethereum: $${ethPrice.usd?.toLocaleString()} ${changeIcon} ${change.toFixed(2)}% | 🤖 /ai ethereum`,
            { parse_mode: 'Markdown' }
        );
    }
});

bot.hears('🚀 Trend Coinler', async (ctx) => {
    await ctx.sendChatAction('typing');
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

📊 AI, son fiyat verileriyle teknik analiz yapacaktır.`, 
    { parse_mode: 'Markdown' });
});

bot.hears('🔍 Coin Ara', (ctx) => {
    ctx.reply(`🔍 **Coin Arama:**
    
/search bitcoin - Bitcoin ara
/search ethereum - Ethereum ara
/search doge - Dogecoin ara

💡 Örnek: /search bitcoin

🔎 Coin'i bulduktan sonra fiyatını görmek için /price kullanın.`, 
    { parse_mode: 'Markdown' });
});

bot.hears('📊 Market', async (ctx) => {
    await ctx.sendChatAction('typing');
    
    // Top 3 coin'in fiyatını göster
    const coins = ['bitcoin', 'ethereum', 'binancecoin'];
    let message = '📊 **Piyasa Özeti**\n\n';
    
    for (const coinId of coins) {
        const priceData = await getCryptoPrice(coinId);
        if (priceData) {
            const change = priceData.usd_24h_change || 0;
            const changeIcon = change >= 0 ? '🟢' : '🔴';
            const coinName = coinId === 'binancecoin' ? 'BNB' : coinId.charAt(0).toUpperCase() + coinId.slice(1);
            message += `• ${coinName}: $${priceData.usd?.toLocaleString()} ${changeIcon} ${change.toFixed(2)}%\n`;
        }
    }
    
    message += '\n🔍 Detaylar için coin adını yazın.';
    ctx.reply(message, { parse_mode: 'Markdown' });
});

bot.hears('📢 Kanalımız', (ctx) => {
    ctx.reply(`📢 **Kripto & Vip Sinyal Kanalımız:**
    
${process.env.CHANNEL_USERNAME || 'https://t.me/coinvekupon'}

💎 VIP sinyaller ve özel analizler için takipte kalın!`, 
    { parse_mode: 'Markdown' });
});

bot.hears('ℹ️ Yardım', (ctx) => {
    ctx.reply(`🤖 **Yardım Menüsü**

**Temel Komutlar:**
/start - Botu başlat
/help - Yardım

**Fiyat Komutları:**
/bitcoin - Bitcoin fiyatı
/ethereum - Ethereum fiyatı
/price <coin> - Özel coin fiyatı
/trend - Trend coinler

**AI Komutları:**
/ai <coin> - AI analizi

**Arama:**
/search <coin> - Coin arama

💎 **Kanal:** ${process.env.CHANNEL_USERNAME || '@coinvekupon'}`,
    { parse_mode: 'Markdown' });
});

// Hata yakalama
bot.catch((err, ctx) => {
    console.error('Bot hatası:', err);
    ctx.reply('❌ Bir hata oluştu. Lütfen daha sonra deneyin.');
});

// Webhook veya polling ile başlatma
const PORT = process.env.PORT || 3000;

console.log('=== BOT BAŞLATILIYOR ===');

// Render ortamında webhook, local'de polling
if (process.env.RENDER_EXTERNAL_URL) {
    // Production - Webhook
    bot.launch({
        webhook: {
            domain: process.env.RENDER_EXTERNAL_URL,
            port: PORT
        }
    }).then(() => {
        console.log('✅ Bot webhook ile başlatıldı');
        console.log('🌐 Domain:', process.env.RENDER_EXTERNAL_URL);
    });
} else {
    // Development - Polling
    bot.launch().then(() => {
        console.log('✅ Bot polling ile başlatıldı');
    });
}

// Webhook veya polling ile başlatma
const PORT = process.env.PORT || 3000;

console.log('=== BOT BAŞLATILIYOR ===');

// Sadece bir yöntem kullanacağız - Webhook YERİNE HTTP server kullan
if (process.env.RENDER_EXTERNAL_URL) {
    // Production - Sadece HTTP server ile başlat
    const http = require('http');
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('🤖 AI Crypto Bot is running...');
    });

    server.listen(PORT, () => {
        console.log(`🚀 HTTP Server running on port ${PORT}`);
        
        // Botu polling ile başlat (webhook YERİNE)
        bot.launch().then(() => {
            console.log('✅ Bot polling ile başlatıldı');
            console.log('🌐 External URL:', process.env.RENDER_EXTERNAL_URL);
        }).catch(error => {
            console.error('❌ Bot başlatılamadı:', error);
            process.exit(1);
        });
    });
} else {
    // Development - Normal polling
    bot.launch().then(() => {
        console.log('✅ Bot development modda başlatıldı');
    }).catch(error => {
        console.error('❌ Bot başlatılamadı:', error);
        process.exit(1);
    });
}

// Graceful shutdown
process.once('SIGINT', () => {
    console.log('🛑 Bot durduruluyor...');
    bot.stop('SIGINT');
    process.exit(0);
});

process.once('SIGTERM', () => {
    console.log('🛑 Bot durduruluyor...');
    bot.stop('SIGTERM');
    process.exit(0);
});
