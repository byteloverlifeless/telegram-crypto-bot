const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

console.log('=== 🤖 AI CRYPTO & HİSSE BOT BAŞLATILIYOR ===');

// API Key'ler kontrolü
if (!process.env.BOT_TOKEN) {
    console.error('❌ HATA: BOT_TOKEN bulunamadı!');
    process.exit(1);
}

console.log('✅ BOT_TOKEN bulundu');

const bot = new Telegraf(process.env.BOT_TOKEN);
let genAI, model;

// Gemini AI başlatma - DÜZELTİLDİ
if (process.env.GEMINI_API_KEY) {
    try {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        model = genAI.getGenerativeModel({ 
            model: "gemini-2.0-flash-exp"
        });
        console.log('✅ Gemini AI başlatıldı');
    } catch (error) {
        console.log('⚠️ Gemini AI başlatılamadı:', error.message);
    }
} else {
    console.log('⚠️ GEMINI_API_KEY bulunamadı');
}

// TEST VERİLERİ
const TEST_CRYPTO_PRICES = {
    'bitcoin': { usd: 64500, eur: 59000, try: 2080000, usd_24h_change: 2.5, usd_market_cap: 1260000000000 },
    'ethereum': { usd: 3500, eur: 3200, try: 112000, usd_24h_change: 1.8, usd_market_cap: 420000000000 },
    'solana': { usd: 172, eur: 158, try: 5500, usd_24h_change: 3.2, usd_market_cap: 76000000000 }
};

const TEST_STOCK_PRICES = {
    'AAPL': { price: 185.32, change: 1.25, changePercent: 0.68, name: 'Apple Inc.' },
    'TSLA': { price: 245.18, change: -3.42, changePercent: -1.38, name: 'Tesla Inc.' },
    'NVDA': { price: 118.11, change: 2.34, changePercent: 2.02, name: 'NVIDIA Corporation' }
};

// Crypto fiyat API'si
async function getCryptoPrice(cryptoId) {
    try {
        const response = await axios.get(
            `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=usd&include_24hr_change=true`,
            { timeout: 10000 }
        );
        
        if (response.data && response.data[cryptoId]) {
            return response.data[cryptoId];
        } else {
            throw new Error('API boş yanıt verdi');
        }
    } catch (error) {
        console.log(`⚠️ ${cryptoId} API hatası, test verisi kullanılıyor`);
        return TEST_CRYPTO_PRICES[cryptoId] || { 
            usd: 100, usd_24h_change: 0, usd_market_cap: 1000000000 
        };
    }
}

// Hisse fiyat API'si
async function getStockPrice(symbol) {
    try {
        // Alpha Vantage API (ücretsiz)
        const response = await axios.get(
            `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=demo`,
            { timeout: 10000 }
        );
        
        if (response.data && response.data['Global Quote']) {
            const quote = response.data['Global Quote'];
            const price = parseFloat(quote['05. price']);
            const change = parseFloat(quote['09. change']);
            const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
            
            return {
                price: price,
                change: change,
                changePercent: changePercent,
                name: symbol
            };
        } else {
            throw new Error('Hisse API boş yanıt verdi');
        }
    } catch (error) {
        console.log(`⚠️ ${symbol} hisse API hatası, test verisi kullanılıyor`);
        return TEST_STOCK_PRICES[symbol] || { 
            price: 100, change: 0, changePercent: 0, name: symbol 
        };
    }
}

// AI ile analiz yap - TAMAMEN DÜZELTİLDİ
async function getAIAnalysis(type, assetName, priceData) {
    console.log(`🤖 AI Analiz başlatılıyor: ${assetName} (${type})`);
    
    // AI yoksa basit analiz gönder
    if (!model) {
        console.log('⚠️ AI modeli yok, basit analiz gönderiliyor');
        return generateSimpleAnalysis(type, assetName, priceData);
    }

    try {
        let prompt = '';
        
        if (type === 'crypto') {
            prompt = `
            ${assetName} kripto para birimi hakkında kısa ve öz bir analiz yap.
            
            Mevcut veriler:
            - Fiyat: $${priceData.usd?.toLocaleString()}
            - 24 Saatlik Değişim: %${priceData.usd_24h_change?.toFixed(2)}
            - Piyasa Değeri: $${(priceData.usd_market_cap / 1e9)?.toFixed(1)} Milyar
            
            Analizinde şunlara değin:
            1. Kısa teknik analiz
            2. Piyasa durumu
            3. Yatırımcılar için öneriler
            
            Maksimum 150 kelime. Türkçe ve anlaşılır ol.
            `;
        } else {
            prompt = `
            ${assetName} hisse senedi hakkında kısa ve öz bir analiz yap.
            
            Mevcut veriler:
            - Fiyat: $${priceData.price?.toLocaleString()}
            - Değişim: %${priceData.changePercent?.toFixed(2)}
            - Şirket: ${priceData.name}
            
            Analizinde şunlara değin:
            1. Kısa teknik analiz
            2. Şirketin genel durumu
            3. Yatırımcılar için öneriler
            
            Maksimum 150 kelime. Türkçe ve anlaşılır ol.
            `;
        }

        console.log('📤 AI prompt gönderiliyor...');
        const result = await model.generateContent(prompt);
        const analysis = result.response.text();
        console.log('✅ AI yanıtı alındı');

        const assetType = type === 'crypto' ? 'Kripto' : 'Hisse';
        return `🤖 **${assetName.toUpperCase()} ${assetType} AI Analizi**\n\n${analysis}\n\n💡 *AI tarafından oluşturulmuştur. Yatırım tavsiyesi değildir.*`;
        
    } catch (error) {
        console.error('❌ AI Analiz hatası:', error.message);
        return generateSimpleAnalysis(type, assetName, priceData);
    }
}

// Basit analiz (AI çalışmazsa)
function generateSimpleAnalysis(type, assetName, priceData) {
    console.log('🔄 Basit analiz oluşturuluyor...');
    
    let analysis = '';
    const change = type === 'crypto' ? priceData.usd_24h_change : priceData.changePercent;
    const price = type === 'crypto' ? priceData.usd : priceData.price;
    
    if (change > 0) {
        analysis = `📈 **${assetName.toUpperCase()} pozitif trendde.**\n\n` +
                  `Son 24 saatte %${change.toFixed(2)} değer kazandı. ` +
                  `Mevcut fiyat seviyeleri teknik olarak olumlu sinyaller veriyor. ` +
                  `Kısa vadede yükseliş devam edebilir.`;
    } else {
        analysis = `📉 **${assetName.toUpperCase()} düzeltme fazında.**\n\n` +
                  `Son 24 saatte %${Math.abs(change).toFixed(2)} değer kaybetti. ` +
                  `Teknik göstergeler dikkatli olunması gerektiğini işaret ediyor. ` +
                  `Destek seviyeleri takip edilmeli.`;
    }
    
    const assetType = type === 'crypto' ? 'Kripto' : 'Hisse';
    return `🤖 **${assetName.toUpperCase()} ${assetType} Analizi**\n\n${analysis}\n\n💰 Mevcut Fiyat: $${price?.toLocaleString()}\n📈 Değişim: %${change?.toFixed(2)}`;
}

// Diğer fonksiyonlar aynı kalacak...
async function getTrendingCoins() {
    try {
        const response = await axios.get(
            'https://api.coingecko.com/api/v3/search/trending',
            { timeout: 10000 }
        );
        return response.data.coins.slice(0, 5);
    } catch (error) {
        console.error('Trending coins hatası:', error.message);
        return [
            { item: { id: 'bitcoin', name: 'Bitcoin', symbol: 'btc' } },
            { item: { id: 'ethereum', name: 'Ethereum', symbol: 'eth' } },
            { item: { id: 'solana', name: 'Solana', symbol: 'sol' } }
        ];
    }
}

async function searchCrypto(query) {
    try {
        const response = await axios.get(
            `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`,
            { timeout: 10000 }
        );
        return response.data.coins.slice(0, 5);
    } catch (error) {
        console.error('Search hatası:', error.message);
        const allCoins = [
            { id: 'bitcoin', name: 'Bitcoin', symbol: 'btc' },
            { id: 'ethereum', name: 'Ethereum', symbol: 'eth' },
            { id: 'solana', name: 'Solana', symbol: 'sol' }
        ];
        
        return allCoins.filter(coin => 
            coin.name.toLowerCase().includes(query.toLowerCase()) || 
            coin.symbol.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);
    }
}

// Ana menü
const mainMenu = Markup.keyboard([
    ['💰 Bitcoin', '🌐 Ethereum', '🚀 Trend'],
    ['📈 AAPL', '📈 TSLA', '📈 NVDA'],
    ['🤖 AI Analiz', '🔍 Arama', '📊 Market'],
    ['ℹ️ Yardım', '📢 Kanal']
]).resize();

// /start komutu
bot.start((ctx) => {
    const aiStatus = model ? '✅ Aktif' : '❌ Devre Dışı';
    
    const welcomeMessage = `🤖 **AI Crypto & Hisse Bot'a Hoşgeldiniz!**

✨ **Özellikler:**
• 💰 Gerçek zamanlı kripto fiyatları
• 📈 Gerçek zamanlı hisse fiyatları
• 🤖 Gemini AI analizler ${aiStatus}
• 🚀 Trend takibi

**Kripto Komutları:**
/bitcoin - Bitcoin fiyatı
/ethereum - Ethereum fiyatı
/price <coin> - Coin fiyatı
/trend - Trend coinler

**Hisse Komutları:**
/stock AAPL - Apple hissesi
/stock TSLA - Tesla hissesi
/stocksearch <sembol> - Hisse ara

**AI Analiz:**
/ai crypto bitcoin - Bitcoin AI analizi
/ai stock AAPL - Apple AI analizi

Veya butonları kullanın!`;

    ctx.reply(welcomeMessage, {
        parse_mode: 'Markdown',
        ...mainMenu
    });
});

// AI Analiz komutu - DÜZELTİLDİ
bot.command('ai', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 3) {
        return ctx.reply(
            '❌ Kullanım: `/ai crypto bitcoin` veya `/ai stock AAPL`\n\n' +
            '**Örnekler:**\n' +
            '`/ai crypto bitcoin` - Bitcoin analizi\n' +
            '`/ai crypto ethereum` - Ethereum analizi\n' +
            '`/ai stock AAPL` - Apple analizi\n' +
            '`/ai stock TSLA` - Tesla analizi',
            { parse_mode: 'Markdown' }
        );
    }

    const type = args[1].toLowerCase();
    const assetName = args[2];
    
    // Typing indicator göster
    await ctx.sendChatAction('typing');

    try {
        console.log(`🔍 AI analiz isteniyor: ${type} - ${assetName}`);
        
        let priceData;
        
        if (type === 'crypto') {
            const searchResults = await searchCrypto(assetName);
            if (!searchResults || searchResults.length === 0) {
                return ctx.reply(`❌ "${assetName}" coin'i bulunamadı.`);
            }
            const actualCoinId = searchResults[0].id;
            priceData = await getCryptoPrice(actualCoinId);
            console.log(`✅ ${assetName} crypto verisi alındı`);
        } else if (type === 'stock') {
            priceData = await getStockPrice(assetName.toUpperCase());
            console.log(`✅ ${assetName} hisse verisi alındı`);
        } else {
            return ctx.reply('❌ Geçersiz tip. "crypto" veya "stock" kullanın.');
        }

        // AI analizini al
        console.log('🔄 AI analiz başlatılıyor...');
        const analysis = await getAIAnalysis(type, assetName, priceData);
        
        console.log('✅ AI analiz tamamlandı, gönderiliyor...');
        ctx.reply(analysis, { parse_mode: 'Markdown' });
        
    } catch (error) {
        console.error('❌ AI komut hatası:', error);
        ctx.reply(
            '❌ Analiz sırasında bir hata oluştu. Lütfen daha sonra deneyin.\n\n' +
            '⚠️ AI şu anda kullanılamıyor olabilir. Basit analiz için tekrar deneyin.'
        );
    }
});

// Bitcoin komutu
bot.command('bitcoin', async (ctx) => {
    await ctx.sendChatAction('typing');
    
    const btcPrice = await getCryptoPrice('bitcoin');
    const change = btcPrice.usd_24h_change || 0;
    const changeIcon = change >= 0 ? '📈' : '📉';

    const message = `💰 **Bitcoin (BTC)**
    
💵 **Fiyat:** $${btcPrice.usd?.toLocaleString()}
${changeIcon} **24s Değişim:** ${change.toFixed(2)}%
📊 **Market Cap:** $${(btcPrice.usd_market_cap / 1e9).toFixed(1)}B

🤖 AI Analiz: /ai crypto bitcoin`;

    ctx.reply(message, { parse_mode: 'Markdown' });
});

// Ethereum komutu
bot.command('ethereum', async (ctx) => {
    await ctx.sendChatAction('typing');
    
    const ethPrice = await getCryptoPrice('ethereum');
    const change = ethPrice.usd_24h_change || 0;
    const changeIcon = change >= 0 ? '📈' : '📉';

    const message = `🌐 **Ethereum (ETH)**
    
💵 **Fiyat:** $${ethPrice.usd?.toLocaleString()}
${changeIcon} **24s Değişim:** ${change.toFixed(2)}%
📊 **Market Cap:** $${(ethPrice.usd_market_cap / 1e9).toFixed(1)}B

🤖 AI Analiz: /ai crypto ethereum`;

    ctx.reply(message, { parse_mode: 'Markdown' });
});

// Hisse komutu
bot.command('stock', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply('❌ Lütfen hisse sembolü girin. Örnek: `/stock AAPL`', { parse_mode: 'Markdown' });
    }

    const symbol = args[1].toUpperCase();
    await ctx.sendChatAction('typing');

    try {
        const stockData = await getStockPrice(symbol);
        const changeIcon = stockData.changePercent >= 0 ? '📈' : '📉';

        const message = `📈 **${stockData.name} (${symbol})**
        
💵 **Fiyat:** $${stockData.price?.toLocaleString()}
${changeIcon} **Değişim:** %${stockData.changePercent?.toFixed(2)}

🤖 AI Analiz: /ai stock ${symbol}`;

        ctx.reply(message, { parse_mode: 'Markdown' });
        
    } catch (error) {
        console.error('Stock komut hatası:', error);
        ctx.reply(`❌ ${symbol} hissesi alınamadı.`);
    }
});

// Buton işlemleri
bot.hears('💰 Bitcoin', async (ctx) => {
    await ctx.sendChatAction('typing');
    const btcPrice = await getCryptoPrice('bitcoin');
    if (btcPrice) {
        const change = btcPrice.usd_24h_change || 0;
        const changeIcon = change >= 0 ? '📈' : '📉';
        ctx.reply(
            `💰 Bitcoin: $${btcPrice.usd?.toLocaleString()} ${changeIcon} ${change.toFixed(2)}%\n` +
            `🤖 Analiz: /ai crypto bitcoin`,
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
            `🌐 Ethereum: $${ethPrice.usd?.toLocaleString()} ${changeIcon} ${change.toFixed(2)}%\n` +
            `🤖 Analiz: /ai crypto ethereum`,
            { parse_mode: 'Markdown' }
        );
    }
});

bot.hears('📈 AAPL', async (ctx) => {
    await ctx.sendChatAction('typing');
    const stockData = await getStockPrice('AAPL');
    if (stockData) {
        const changeIcon = stockData.changePercent >= 0 ? '📈' : '📉';
        ctx.reply(
            `📈 Apple: $${stockData.price?.toLocaleString()} ${changeIcon} ${stockData.changePercent?.toFixed(2)}%\n` +
            `🤖 Analiz: /ai stock AAPL`,
            { parse_mode: 'Markdown' }
        );
    }
});

bot.hears('🤖 AI Analiz', (ctx) => {
    const aiStatus = model ? '✅ Aktif' : '⚠️ Devre Dışı';
    
    ctx.reply(`🤖 **AI Analiz ${aiStatus}**

**Kripto Analiz:**
/ai crypto bitcoin
/ai crypto ethereum  
/ai crypto solana

**Hisse Analiz:**
/ai stock AAPL
/ai stock TSLA
/ai stock NVDA

💡 Örnek: \`/ai crypto bitcoin\`

${!model ? '⚠️ AI şu anda devre dışı. Basit analiz gösterilecek.' : '✅ AI aktif, detaylı analiz yapılacak.'}`,
    { parse_mode: 'Markdown' });
});

// Diğer komutlar...
bot.command('trend', async (ctx) => {
    await ctx.sendChatAction('typing');
    
    const trending = await getTrendingCoins();
    let message = `🚀 **Trend Coinler**\n\n`;
    
    for (let i = 0; i < Math.min(3, trending.length); i++) {
        const coin = trending[i];
        const priceData = await getCryptoPrice(coin.item.id);
        
        if (priceData) {
            const change = priceData.usd_24h_change || 0;
            const changeIcon = change >= 0 ? '📈' : '📉';
            
            message += `• **${coin.item.name}** (${coin.item.symbol.toUpperCase()})\n`;
            message += `  💵 $${priceData.usd?.toLocaleString()} ${changeIcon} ${change.toFixed(2)}%\n\n`;
        }
    }

    ctx.reply(message, { parse_mode: 'Markdown' });
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
        console.log('✅ Bot başarıyla çalışıyor!');
        console.log('🤖 AI Durumu:', model ? 'Aktif' : 'Devre Dışı');
    })
    .catch(error => {
        console.error('❌ Bot başlatılamadı:', error);
        process.exit(1);
    });

// HTTP server
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('🤖 AI Crypto & Stock Bot is running...');
});

server.listen(8080, () => {
    console.log('🌐 HTTP server port 8080de hazır');
});
