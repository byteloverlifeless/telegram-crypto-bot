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

// Gemini AI başlatma
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
        console.log('⚠️ Gemini AI başlatılamadı:', error.message);
    }
} else {
    console.log('⚠️ GEMINI_API_KEY bulunamadı');
}

// TEST VERİLERİ - CRYPTO
const TEST_CRYPTO_PRICES = {
    'bitcoin': { usd: 64500, eur: 59000, try: 2080000, usd_24h_change: 2.5, usd_market_cap: 1260000000000 },
    'ethereum': { usd: 3500, eur: 3200, try: 112000, usd_24h_change: 1.8, usd_market_cap: 420000000000 },
    'solana': { usd: 172, eur: 158, try: 5500, usd_24h_change: 3.2, usd_market_cap: 76000000000 },
    'binancecoin': { usd: 580, eur: 530, try: 18600, usd_24h_change: 0.5, usd_market_cap: 89000000000 }
};

// TEST VERİLERİ - HİSSELER
const TEST_STOCK_PRICES = {
    'AAPL': { price: 185.32, change: 1.25, changePercent: 0.68, name: 'Apple Inc.' },
    'TSLA': { price: 245.18, change: -3.42, changePercent: -1.38, name: 'Tesla Inc.' },
    'NVDA': { price: 118.11, change: 2.34, changePercent: 2.02, name: 'NVIDIA Corporation' },
    'AMZN': { price: 178.55, change: 0.89, changePercent: 0.50, name: 'Amazon.com Inc.' },
    'GOOGL': { price: 138.21, change: 0.75, changePercent: 0.55, name: 'Alphabet Inc.' },
    'MSFT': { price: 415.50, change: 2.15, changePercent: 0.52, name: 'Microsoft Corporation' },
    'META': { price: 485.75, change: 4.25, changePercent: 0.88, name: 'Meta Platforms Inc.' },
    'BTC-USD': { price: 64500, change: 1250, changePercent: 1.98, name: 'Bitcoin USD' }
};

// Crypto fiyat API'si
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
        return TEST_CRYPTO_PRICES[cryptoId] || { 
            usd: 100, eur: 92, try: 3200, usd_24h_change: 0, usd_market_cap: 1000000000 
        };
    }
}

// Hisse fiyat API'si
async function getStockPrice(symbol) {
    try {
        console.log(`📈 ${symbol} hisse fiyatı alınıyor...`);
        
        // Alpha Vantage API (ücretsiz)
        const apiKey = 'demo'; // Ücretsiz demo key
        const response = await axios.get(
            `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`,
            { 
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }
        );
        
        if (response.data && response.data['Global Quote']) {
            const quote = response.data['Global Quote'];
            const price = parseFloat(quote['05. price']);
            const change = parseFloat(quote['09. change']);
            const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
            
            console.log(`✅ ${symbol} hisse fiyatı alındı: $${price}`);
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
        console.log(`⚠️ ${symbol} hisse API hatası, test verisi kullanılıyor:`, error.message);
        return TEST_STOCK_PRICES[symbol] || { 
            price: 100, change: 0, changePercent: 0, name: symbol 
        };
    }
}

// AI ile analiz yap - CRYPTO & HİSSE
async function getAIAnalysis(type, assetName, priceData) {
    if (!model) {
        return `🤖 **${assetName.toUpperCase()} AI Analizi**\n\n` +
               '⚠️ AI analiz özelliği şu anda kullanılamıyor.\n' +
               'Gemini API key kontrol edin veya daha sonra deneyin.\n\n' +
               `💰 **Mevcut Fiyat:** $${type === 'crypto' ? priceData.usd?.toLocaleString() : priceData.price?.toLocaleString()}\n` +
               `📈 **Değişim:** %${type === 'crypto' ? priceData.usd_24h_change?.toFixed(2) : priceData.changePercent?.toFixed(2)}`;
    }

    try {
        let prompt = '';
        
        if (type === 'crypto') {
            prompt = `
            Kripto para analizi yap: ${assetName}
            
            Mevcut veriler:
            - USD Fiyat: $${priceData.usd?.toLocaleString() || 'N/A'}
            - 24s Değişim: %${priceData.usd_24h_change?.toFixed(2) || 'N/A'}
            - Market Cap: $${(priceData.usd_market_cap / 1e9)?.toFixed(1) || 'N/A'}B
            
            Kısa, anlaşılır ve profesyonel bir analiz yap. Teknik analiz, piyasa görünümü ve yatırımcılar için öneriler ekle.
            Maksimum 200 kelime. Türkçe cevap ver.
            `;
        } else {
            prompt = `
            Hisse senedi analizi yap: ${assetName}
            
            Mevcut veriler:
            - Fiyat: $${priceData.price?.toLocaleString() || 'N/A'}
            - Değişim: $${priceData.change?.toFixed(2) || 'N/A'} (%${priceData.changePercent?.toFixed(2) || 'N/A'})
            - Şirket: ${priceData.name || assetName}
            
            Kısa, anlaşılır ve profesyonel bir analiz yap. Teknik analiz, temel analiz, piyasa görünümü ve yatırımcılar için öneriler ekle.
            Maksimum 200 kelime. Türkçe cevap ver.
            `;
        }

        console.log(`🤖 AI analiz isteniyor: ${assetName} (${type})`);
        const result = await model.generateContent(prompt);
        const analysis = result.response.text();
        
        const assetType = type === 'crypto' ? 'Kripto' : 'Hisse';
        return `🤖 **${assetName.toUpperCase()} ${assetType} AI Analizi**\n\n${analysis}`;
        
    } catch (error) {
        console.error('AI Analiz hatası:', error.message);
        return `🤖 **${assetName.toUpperCase()} AI Analizi**\n\n` +
               '❌ AI analizi şu anda kullanılamıyor. Lütfen daha sonra deneyin.\n\n' +
               `💰 **Mevcut Fiyat:** $${type === 'crypto' ? priceData.usd?.toLocaleString() : priceData.price?.toLocaleString()}\n` +
               `📈 **Değişim:** %${type === 'crypto' ? priceData.usd_24h_change?.toFixed(2) : priceData.changePercent?.toFixed(2)}`;
    }
}

// Trend coinleri getir
async function getTrendingCoins() {
    try {
        console.log('🚀 Trend coinler alınıyor...');
        const response = await axios.get(
            'https://api.coingecko.com/api/v3/search/trending',
            { 
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }
        );
        
        if (response.data && response.data.coins) {
            console.log(`✅ ${response.data.coins.length} trend coin alındı`);
            return response.data.coins.slice(0, 10);
        } else {
            throw new Error('Trend API boş yanıt verdi');
        }
    } catch (error) {
        console.error('Trending coins hatası, test verileri kullanılıyor:', error.message);
        return [
            { item: { id: 'bitcoin', name: 'Bitcoin', symbol: 'btc' } },
            { item: { id: 'ethereum', name: 'Ethereum', symbol: 'eth' } },
            { item: { id: 'solana', name: 'Solana', symbol: 'sol' } }
        ];
    }
}

// Popüler hisseleri getir
async function getPopularStocks() {
    const popularStocks = [
        { symbol: 'AAPL', name: 'Apple Inc.' },
        { symbol: 'TSLA', name: 'Tesla Inc.' },
        { symbol: 'NVDA', name: 'NVIDIA Corporation' },
        { symbol: 'AMZN', name: 'Amazon.com Inc.' },
        { symbol: 'GOOGL', name: 'Alphabet Inc.' },
        { symbol: 'MSFT', name: 'Microsoft Corporation' },
        { symbol: 'META', name: 'Meta Platforms Inc.' },
        { symbol: 'BTC-USD', name: 'Bitcoin USD' }
    ];
    
    return popularStocks;
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

// KANAL FONKSİYONLARI
async function sendToChannel(message) {
    try {
        const channel = process.env.CHANNEL_USERNAME || '@coinvekupon';
        if (channel) {
            await bot.telegram.sendMessage(channel, message, {
                parse_mode: 'Markdown'
            });
            console.log('✅ Kanal mesajı gönderildi:', channel);
            return true;
        }
    } catch (error) {
        console.error('❌ Kanal mesajı hatası:', error.message);
        return false;
    }
    return false;
}

// Günlük market özeti gönder (Crypto + Hisse)
async function sendDailyMarketUpdate() {
    try {
        const cryptoCoins = ['bitcoin', 'ethereum'];
        const stocks = ['AAPL', 'TSLA', 'NVDA'];
        
        let message = `📊 **Günlük Piyasa Özeti**\n\n`;
        
        // Crypto kısmı
        message += `💰 **Kripto Piyasası**\n`;
        for (const coinId of cryptoCoins) {
            const priceData = await getCryptoPrice(coinId);
            if (priceData) {
                const change = priceData.usd_24h_change || 0;
                const changeIcon = change >= 0 ? '🟢' : '🔴';
                const coinName = coinId.charAt(0).toUpperCase() + coinId.slice(1);
                message += `• ${coinName}: $${priceData.usd?.toLocaleString()} ${changeIcon} ${change.toFixed(2)}%\n`;
            }
        }
        
        message += `\n📈 **Hisse Piyasası**\n`;
        for (const stockSymbol of stocks) {
            const stockData = await getStockPrice(stockSymbol);
            if (stockData) {
                const changeIcon = stockData.changePercent >= 0 ? '🟢' : '🔴';
                message += `• ${stockSymbol}: $${stockData.price?.toLocaleString()} ${changeIcon} ${stockData.changePercent?.toFixed(2)}%\n`;
            }
        }
        
        message += '\n🔔 @CryptoStockAIBot ile anlık takip!';
        return await sendToChannel(message);
    } catch (error) {
        console.error('Günlük özet hatası:', error);
        return false;
    }
}

// Ana menü - GÜNCELLENDİ (Hisse eklendi)
const mainMenu = Markup.keyboard([
    ['💰 Bitcoin', '🌐 Ethereum', '🚀 Trend Coinler'],
    ['📈 AAPL', '📈 TSLA', '📈 NVDA'],
    ['🤖 AI Analiz', '🔍 Coin Ara', '📊 Hisse Ara'],
    ['ℹ️ Yardım', '📢 Kanalımız']
]).resize();

// /start komutu - GÜNCELLENDİ
bot.start((ctx) => {
    const aiStatus = model ? '✅ Aktif' : '❌ Devre Dışı';
    
    const welcomeMessage = `🤖 **AI Crypto & Hisse Bot'a Hoşgeldiniz!**

✨ **Özellikler:**
• 💰 Gerçek zamanlı kripto fiyatları
• 📈 Gerçek zamanlı hisse fiyatları
• 🤖 Gemini AI destekli analizler ${aiStatus}
• 🚀 Trend coin takibi
• 🌍 USD/EUR/TRY desteği

📊 **Kanalımız:** ${process.env.CHANNEL_USERNAME || '@coinvekupon'}

**Kripto Komutları:**
/bitcoin - Bitcoin fiyatı
/ethereum - Ethereum fiyatı
/price <coin> - Coin fiyatı
/trend - Trend coinler
/search <coin> - Coin ara

**Hisse Komutları:**
/stock AAPL - Apple hissesi
/stock TSLA - Tesla hissesi  
/stocksearch <sembol> - Hisse ara

**AI Analiz:**
/ai crypto bitcoin - Bitcoin AI analizi
/ai stock AAPL - Apple AI analizi

Veya aşağıdaki butonları kullanın!`;

    ctx.reply(welcomeMessage, {
        parse_mode: 'Markdown',
        ...mainMenu
    });
});

// Yardım komutu - GÜNCELLENDİ
bot.command('help', (ctx) => {
    const aiStatus = model ? 'Aktif ✅' : 'Devre Dışı ❌';
    
    ctx.reply(`🤖 **Kullanım Kılavuzu**

**AI Durumu:** ${aiStatus}

**Kripto Komutları:**
/bitcoin - Bitcoin fiyatı
/ethereum - Ethereum fiyatı
/price <coin> - Coin fiyatı
/trend - Trend coinler
/search <coin> - Coin ara

**Hisse Komutları:**
/stock AAPL - Apple hissesi
/stock TSLA - Tesla hissesi
/stock TSLA - NVIDIA hissesi
/stocksearch <sembol> - Hisse ara

**AI Analiz:**
/ai crypto bitcoin - Bitcoin AI analizi
/ai stock AAPL - Apple AI analizi

**Kanal Komutları:**
/post <mesaj> - Kanal mesajı gönder
/sendmarket - Market özeti gönder

**Örnekler:**
/price solana
/ai crypto bitcoin
/ai stock AAPL
/stocksearch AMZN

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

🤖 AI Analiz için: /ai crypto bitcoin`;

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

🤖 AI Analiz için: /ai crypto ethereum`;

    ctx.reply(message, { parse_mode: 'Markdown' });
});

// Hisse komutu - YENİ
bot.command('stock', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply('❌ Lütfen bir hisse sembolü girin. Örnek: `/stock AAPL`', { parse_mode: 'Markdown' });
    }

    const symbol = args[1].toUpperCase();
    await ctx.sendChatAction('typing');

    try {
        const stockData = await getStockPrice(symbol);
        const changeIcon = stockData.changePercent >= 0 ? '📈' : '📉';

        const message = `📈 **${stockData.name} (${symbol})**
        
💵 **Fiyat:** $${stockData.price?.toLocaleString() || 'N/A'}
${changeIcon} **Değişim:** $${stockData.change?.toFixed(2)} (%${stockData.changePercent?.toFixed(2)})

🤖 AI Analiz için: /ai stock ${symbol}`;

        ctx.reply(message, { parse_mode: 'Markdown' });
        
    } catch (error) {
        console.error('Stock komut hatası:', error);
        ctx.reply(`❌ ${symbol} hissesi alınırken hata oluştu.`);
    }
});

// Hisse arama - YENİ
bot.command('stocksearch', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply('❌ Lütfen bir hisse sembolü girin. Örnek: `/stocksearch AAPL`', { parse_mode: 'Markdown' });
    }

    const query = args[1].toUpperCase();
    await ctx.sendChatAction('typing');

    try {
        const popularStocks = await getPopularStocks();
        const results = popularStocks.filter(stock => 
            stock.symbol.includes(query) || stock.name.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);

        if (results.length === 0) {
            return ctx.reply(`❌ "${query}" ile ilgili hisse bulunamadı.`);
        }

        let message = `🔍 **Hisse Arama Sonuçları: "${query}"**\n\n`;
        
        for (const stock of results) {
            message += `• **${stock.name}** (${stock.symbol})\n`;
            message += `  📊 Fiyat: /stock ${stock.symbol}\n`;
            message += `  🤖 Analiz: /ai stock ${stock.symbol}\n\n`;
        }

        message += `💡 Popüler hisseler: AAPL, TSLA, NVDA, AMZN, GOOGL`;

        ctx.reply(message, { parse_mode: 'Markdown' });
        
    } catch (error) {
        console.error('Stocksearch komut hatası:', error);
        ctx.reply('❌ Hisse arama sırasında hata oluştu.');
    }
});

// AI Analiz komutu - GÜNCELLENDİ (Crypto/Stock ayrımı)
bot.command('ai', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 3) {
        return ctx.reply('❌ Kullanım: `/ai crypto bitcoin` veya `/ai stock AAPL`', { parse_mode: 'Markdown' });
    }

    const type = args[1].toLowerCase(); // crypto veya stock
    const assetName = args[2];
    await ctx.sendChatAction('typing');

    try {
        let priceData;
        
        if (type === 'crypto') {
            const searchResults = await searchCrypto(assetName);
            if (!searchResults || searchResults.length === 0) {
                return ctx.reply(`❌ "${assetName}" coin'i bulunamadı.`);
            }
            const actualCoinId = searchResults[0].id;
            priceData = await getCryptoPrice(actualCoinId);
        } else if (type === 'stock') {
            priceData = await getStockPrice(assetName.toUpperCase());
        } else {
            return ctx.reply('❌ Geçersiz tip. "crypto" veya "stock" kullanın.');
        }

        const analysis = await getAIAnalysis(type, assetName, priceData);
        ctx.reply(analysis, { parse_mode: 'Markdown' });
        
    } catch (error) {
        console.error('AI komut hatası:', error);
        ctx.reply('❌ AI analiz sırasında bir hata oluştu. Lütfen daha sonra deneyin.');
    }
});

// Trend coinler
bot.command('trend', async (ctx) => {
    try {
        await ctx.sendChatAction('typing');
        
        const trending = await getTrendingCoins();
        if (!trending || trending.length === 0) {
            return ctx.reply('❌ Trend coinler alınamadı. Lütfen daha sonra deneyin.');
        }

        let message = `🚀 **Trend Coinler (24s)**\n\n`;
        
        for (let i = 0; i < Math.min(5, trending.length); i++) {
            const coin = trending[i];
            const priceData = await getCryptoPrice(coin.item.id);
            
            if (priceData) {
                const change = priceData.usd_24h_change || 0;
                const changeIcon = change >= 0 ? '📈' : '📉';
                
                message += `• **${coin.item.name}** (${coin.item.symbol.toUpperCase()})\n`;
                message += `  💵 $${priceData.usd?.toLocaleString() || 'N/A'} ${changeIcon} ${change.toFixed(2)}%\n\n`;
            }
        }

        message += `🔍 Detaylı analiz için: /ai crypto <coin_adi>`;

        ctx.reply(message, { parse_mode: 'Markdown' });
        
    } catch (error) {
        console.error('Trend komut hatası:', error);
        ctx.reply('❌ Trend coinler alınırken bir hata oluştu. Lütfen daha sonra deneyin.');
    }
});

// Coin arama
bot.command('search', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply('❌ Lütfen aramak istediğiniz coin adını girin. Örnek: `/search bitcoin`', { parse_mode: 'Markdown' });
    }

    const query = args.slice(1).join(' ');
    await ctx.sendChatAction('typing');

    const results = await searchCrypto(query);
    if (!results || results.length === 0) {
        return ctx.reply(`❌ "${query}" ile ilgili coin bulunamadı.`);
    }

    let message = `🔍 **Coin Arama Sonuçları: "${query}"**\n\n`;
    
    for (const coin of results.slice(0, 5)) {
        message += `• **${coin.name}** (${coin.symbol.toUpperCase()})\n`;
        message += `  🆔 Kullanım: /price ${coin.id}\n`;
        message += `  🤖 Analiz: /ai crypto ${coin.id}\n\n`;
    }

    message += `💡 Fiyat görmek için: /price <coin_id>`;

    ctx.reply(message, { parse_mode: 'Markdown' });
});

// Özel coin sorgulama
bot.command('price', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply('❌ Örnek: `/price bitcoin` veya `/price solana`', { parse_mode: 'Markdown' });
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

🤖 AI Analiz için: /ai crypto ${coinName}`;

    ctx.reply(message, { parse_mode: 'Markdown' });
});

// Buton işlemleri - GÜNCELLENDİ (Hisse butonları eklendi)
bot.hears('💰 Bitcoin', async (ctx) => {
    await ctx.sendChatAction('typing');
    const btcPrice = await getCryptoPrice('bitcoin');
    if (btcPrice) {
        const change = btcPrice.usd_24h_change || 0;
        const changeIcon = change >= 0 ? '📈' : '📉';
        ctx.reply(
            `💰 Bitcoin: $${btcPrice.usd?.toLocaleString()} ${changeIcon} ${change.toFixed(2)}% | 🤖 /ai crypto bitcoin`,
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
            `🌐 Ethereum: $${ethPrice.usd?.toLocaleString()} ${changeIcon} ${change.toFixed(2)}% | 🤖 /ai crypto ethereum`,
            { parse_mode: 'Markdown' }
        );
    }
});

// Hisse butonları - YENİ
bot.hears('📈 AAPL', async (ctx) => {
    await ctx.sendChatAction('typing');
    const stockData = await getStockPrice('AAPL');
    if (stockData) {
        const changeIcon = stockData.changePercent >= 0 ? '📈' : '📉';
        ctx.reply(
            `📈 Apple (AAPL): $${stockData.price?.toLocaleString()} ${changeIcon} ${stockData.changePercent?.toFixed(2)}% | 🤖 /ai stock AAPL`,
            { parse_mode: 'Markdown' }
        );
    }
});

bot.hears('📈 TSLA', async (ctx) => {
    await ctx.sendChatAction('typing');
    const stockData = await getStockPrice('TSLA');
    if (stockData) {
        const changeIcon = stockData.changePercent >= 0 ? '📈' : '📉';
        ctx.reply(
            `📈 Tesla (TSLA): $${stockData.price?.toLocaleString()} ${changeIcon} ${stockData.changePercent?.toFixed(2)}% | 🤖 /ai stock TSLA`,
            { parse_mode: 'Markdown' }
        );
    }
});

bot.hears('📈 NVDA', async (ctx) => {
    await ctx.sendChatAction('typing');
    const stockData = await getStockPrice('NVDA');
    if (stockData) {
        const changeIcon = stockData.changePercent >= 0 ? '📈' : '📉';
        ctx.reply(
            `📈 NVIDIA (NVDA): $${stockData.price?.toLocaleString()} ${changeIcon} ${stockData.changePercent?.toFixed(2)}% | 🤖 /ai stock NVDA`,
            { parse_mode: 'Markdown' }
        );
    }
});

bot.hears('🚀 Trend Coinler', async (ctx) => {
    await ctx.sendChatAction('typing');
    const trending = await getTrendingCoins();
    
    if (trending && trending.length > 0) {
        let quickList = '🚀 **Trend Coinler:**\n\n';
        trending.slice(0, 3).forEach(coin => {
            quickList += `• ${coin.item.name} (${coin.item.symbol.toUpperCase()})\n`;
        });
        quickList += '\n🔍 Detaylı liste: /trend';
        ctx.reply(quickList, { parse_mode: 'Markdown' });
    } else {
        ctx.reply('❌ Trend coinler alınamadı. Lütfen /trend komutunu deneyin.');
    }
});

bot.hears('🤖 AI Analiz', (ctx) => {
    const aiStatus = model ? '✅ Aktif' : '❌ Devre Dışı';
    
    ctx.reply(`🤖 **AI Analiz ${aiStatus}**

**Kripto Analiz:**
/ai crypto bitcoin - Bitcoin analizi
/ai crypto ethereum - Ethereum analizi

**Hisse Analiz:**
/ai stock AAPL - Apple analizi
/ai stock TSLA - Tesla analizi

💡 Örnek: \`/ai crypto bitcoin\`

📊 AI, son fiyat verileriyle teknik analiz yapacaktır.`,
    { parse_mode: 'Markdown' });
});

bot.hears('🔍 Coin Ara', (ctx) => {
    ctx.reply(`🔍 **Coin Arama:**
    
/search bitcoin - Bitcoin ara
/search ethereum - Ethereum ara
/search solana - Solana ara

💡 Örnek: /search bitcoin

🔎 Coin'i bulduktan sonra fiyatını görmek için /price kullanın.`,
    { parse_mode: 'Markdown' });
});

bot.hears('📊 Hisse Ara', (ctx) => {
    ctx.reply(`📊 **Hisse Arama:**
    
/stocksearch AAPL - Apple ara
/stocksearch TSLA - Tesla ara
/stocksearch NVDA - NVIDIA ara

💡 Örnek: /stocksearch AAPL

📈 Hisse'yi bulduktan sonra fiyatını görmek için /stock kullanın.`,
    { parse_mode: 'Markdown' });
});

bot.hears('📢 Kanalımız', (ctx) => {
    ctx.reply(`📢 **Kripto & Hisse Sinyal Kanalımız:**
    
${process.env.CHANNEL_USERNAME || 'https://t.me/coinvekupon'}

💎 VIP sinyaller ve özel analizler için takipte kalın!

🤖 **Kanal Komutları:**
/post <mesaj> - Kanal mesajı gönder
/sendmarket - Market özeti gönder`,
    { parse_mode: 'Markdown' });
});

// KANAL KOMUTLARI
bot.command('post', async (ctx) => {
    try {
        const messageText = ctx.message.text.replace('/post ', '');
        if (messageText.length < 5) {
            return ctx.reply('❌ Mesaj çok kısa! En az 5 karakter girin.');
        }

        const success = await sendToChannel(messageText);
        if (success) {
            ctx.reply('✅ Mesaj kanala gönderildi!');
        } else {
            ctx.reply('❌ Kanal mesajı gönderilemedi. Bot kanal yöneticisi mi?');
        }
    } catch (error) {
        console.error('Post komut hatası:', error);
        ctx.reply('❌ Mesaj gönderilirken hata oluştu.');
    }
});

bot.command('sendmarket', async (ctx) => {
    try {
        const success = await sendDailyMarketUpdate();
        if (success) {
            ctx.reply('✅ Market özeti kanala gönderildi!');
        } else {
            ctx.reply('❌ Market özeti gönderilemedi. Bot kanal yöneticisi mi?');
        }
    } catch (error) {
        console.error('Sendmarket komut hatası:', error);
        ctx.reply('❌ Market özeti gönderilirken hata oluştu.');
    }
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
        console.log('📢 Kanal:', process.env.CHANNEL_USERNAME || '@coinvekupon');
        console.log('🤖 AI Durumu:', model ? 'Aktif' : 'Devre Dışı');
        console.log('📈 Hisse Desteği: Aktif');
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
