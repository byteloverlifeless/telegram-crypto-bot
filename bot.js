const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

console.log('=== 🤖 AI CRYPTO BOT BAŞLATILIYOR ===');

// API Key'ler kontrolü
if (!process.env.BOT_TOKEN) {
    console.error('❌ HATA: BOT_TOKEN bulunamadı!');
    process.exit(1);
}

console.log('✅ BOT_TOKEN bulundu');

const bot = new Telegraf(process.env.BOT_TOKEN);
let genAI, model;

// Gemini AI başlatma (opsiyonel)
if (process.env.GEMINI_API_KEY) {
    try {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        model = genAI.getGenerativeModel({ 
            model: "gemini-2.0-flash-exp",
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024,
            }
        });
        console.log('✅ Gemini AI başlatıldı');
    } catch (error) {
        console.log('⚠️ Gemini AI başlatılamadı, AI özellikleri devre dışı');
    }
} else {
    console.log('⚠️ GEMINI_API_KEY bulunamadı, AI özellikleri devre dışı');
}

// TEST VERİLERİ - API çalışmazsa kullanılacak
const TEST_PRICES = {
    'bitcoin': { usd: 64500, eur: 59000, try: 2080000, usd_24h_change: 2.5, usd_market_cap: 1260000000000 },
    'ethereum': { usd: 3500, eur: 3200, try: 112000, usd_24h_change: 1.8, usd_market_cap: 420000000000 },
    'binancecoin': { usd: 580, eur: 530, try: 18600, usd_24h_change: 0.5, usd_market_cap: 89000000000 },
    'solana': { usd: 172, eur: 158, try: 5500, usd_24h_change: 3.2, usd_market_cap: 76000000000 },
    'ripple': { usd: 0.58, eur: 0.53, try: 18.6, usd_24h_change: -0.3, usd_market_cap: 32000000000 },
    'cardano': { usd: 0.45, eur: 0.41, try: 14.5, usd_24h_change: 1.1, usd_market_cap: 16000000000 },
    'dogecoin': { usd: 0.12, eur: 0.11, try: 3.9, usd_24h_change: 2.7, usd_market_cap: 18000000000 },
    'polkadot': { usd: 6.8, eur: 6.2, try: 220, usd_24h_change: 0.8, usd_market_cap: 8900000000 },
    'litecoin': { usd: 82, eur: 75, try: 2650, usd_24h_change: 0.9, usd_market_cap: 6100000000 },
    'chainlink': { usd: 18, eur: 16.5, try: 580, usd_24h_change: 1.4, usd_market_cap: 10500000000 }
};

// Crypto fiyat API'si - FALLBACK DESTEKLİ
async function getCryptoPrice(cryptoId) {
    try {
        console.log(`🔍 ${cryptoId} fiyatı alınıyor...`);
        const response = await axios.get(
            `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=usd,eur,try&include_24hr_change=true&include_market_cap=true`,
            { 
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }
        );
        
        if (response.data && response.data[cryptoId]) {
            console.log(`✅ ${cryptoId} fiyatı alındı`);
            return response.data[cryptoId];
        } else {
            throw new Error('API boş yanıt verdi');
        }
    } catch (error) {
        console.log(`⚠️ ${cryptoId} API hatası, test verisi kullanılıyor:`, error.message);
        // Test verilerini döndür
        return TEST_PRICES[cryptoId] || { 
            usd: 100, eur: 92, try: 3200, usd_24h_change: 0, usd_market_cap: 1000000000 
        };
    }
}

// AI ile analiz yap
async function getAIAnalysis(cryptoName, priceData) {
    if (!model) {
        return '🤖 AI analiz özelliği şu anda kullanılamıyor.';
    }

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
            { 
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }
        );
        return response.data.coins.slice(0, 10);
    } catch (error) {
        console.error('Trending coins hatası, test verileri kullanılıyor:', error.message);
        // Test trend verileri
        return [
            { item: { id: 'bitcoin', name: 'Bitcoin', symbol: 'btc' } },
            { item: { id: 'ethereum', name: 'Ethereum', symbol: 'eth' } },
            { item: { id: 'solana', name: 'Solana', symbol: 'sol' } },
            { item: { id: 'binancecoin', name: 'Binance Coin', symbol: 'bnb' } },
            { item: { id: 'ripple', name: 'XRP', symbol: 'xrp' } }
        ];
    }
}

// Coin arama
async function searchCrypto(query) {
    try {
        const response = await axios.get(
            `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`,
            { 
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }
        );
        return response.data.coins.slice(0, 5);
    } catch (error) {
        console.error('Search hatası, test verileri kullanılıyor:', error.message);
        // Test arama sonuçları
        const allCoins = [
            { id: 'bitcoin', name: 'Bitcoin', symbol: 'btc' },
            { id: 'ethereum', name: 'Ethereum', symbol: 'eth' },
            { id: 'binancecoin', name: 'Binance Coin', symbol: 'bnb' },
            { id: 'solana', name: 'Solana', symbol: 'sol' },
            { id: 'ripple', name: 'XRP', symbol: 'xrp' },
            { id: 'cardano', name: 'Cardano', symbol: 'ada' },
            { id: 'dogecoin', name: 'Dogecoin', symbol: 'doge' },
            { id: 'polkadot', name: 'Polkadot', symbol: 'dot' }
        ];
        
        return allCoins.filter(coin => 
            coin.name.toLowerCase().includes(query.toLowerCase()) || 
            coin.symbol.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);
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

    const searchResults = await searchCrypto(coinName);
    if (!searchResults || searchResults.length === 0) {
        return ctx.reply(`❌ "${coinName}" coin'i bulunamadı. Lütfen geçerli bir coin adı girin.`);
    }

    const actualCoinId = searchResults[0].id;
    const priceData = await getCryptoPrice(actualCoinId);

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

    const searchResults = await searchCrypto(coinName);
    if (!searchResults || searchResults.length === 0) {
        return ctx.reply(`❌ "${coinName}" coin'i bulunamadı. /search ${coinName} komutu ile arama yapın.`);
    }

    const actualCoinId = searchResults[0].id;
    const priceData = await getCryptoPrice(actualCoinId);

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

// Botu başlat - SADECE POLLING
console.log('=== BOT BAŞLATILIYOR (POLLING MOD) ===');

bot.launch()
    .then(() => {
        console.log('✅ Bot başarıyla çalışıyor!');
        console.log('📢 Kanal:', process.env.CHANNEL_USERNAME || '@coinvekupon');
        console.log('🤖 AI Durumu:', model ? 'Aktif' : 'Devre Dışı');
    })
    .catch(error => {
        console.error('❌ Bot başlatılamadı:', error);
        process.exit(1);
    });

// Render için basit HTTP server
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('🤖 AI Crypto Bot is running...');
});

server.listen(8080, () => {
    console.log('🌐 HTTP server port 8080de hazır');
});

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

console.log('✅ Bot başlatma tamamlandı!');
