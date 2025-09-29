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
    'bitcoin': { usd: 64500, usd_24h_change: 2.5, usd_market_cap: 1260000000000 },
    'ethereum': { usd: 3500, usd_24h_change: 1.8, usd_market_cap: 420000000000 },
    'solana': { usd: 172, usd_24h_change: 3.2, usd_market_cap: 76000000000 },
    'cardano': { usd: 0.45, usd_24h_change: 5.1, usd_market_cap: 16000000000 }
};

const TEST_STOCK_PRICES = {
    'AAPL': { price: 185.32, change: 1.25, changePercent: 0.68, name: 'Apple Inc.' },
    'TSLA': { price: 245.18, change: -3.42, changePercent: -1.38, name: 'Tesla Inc.' },
    'NVDA': { price: 118.11, change: 2.34, changePercent: 2.02, name: 'NVIDIA Corporation' },
    'MSTR': { price: 685.50, change: 12.25, changePercent: 1.82, name: 'MicroStrategy' }
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
            usd: 100, usd_24h_change: 0
        };
    }
}

// Hisse fiyat API'si
async function getStockPrice(symbol) {
    try {
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

// HAFTALIK PATLAMA POTANSİYELİ YÜKSEK COIN/HİSSE ANALİZİ
async function getWeeklyExplosionPotential() {
    try {
        console.log('🔍 Haftalık patlama potansiyeli analiz ediliyor...');
        
        // Analiz edilecek coinler ve hisseler
        const analysisList = {
            crypto: ['bitcoin', 'ethereum', 'solana', 'cardano', 'chainlink'],
            stocks: ['AAPL', 'TSLA', 'NVDA', 'MSTR', 'COIN']
        };

        let bestCrypto = { name: '', change: -100 };
        let bestStock = { name: '', change: -100 };

        // Coin'leri analiz et
        for (const crypto of analysisList.crypto) {
            try {
                const priceData = await getCryptoPrice(crypto);
                if (priceData && priceData.usd_24h_change > bestCrypto.change) {
                    bestCrypto = { 
                        name: crypto, 
                        change: priceData.usd_24h_change,
                        price: priceData.usd
                    };
                }
                // 1 saniye bekle (API limiti için)
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.log(`⚠️ ${crypto} analiz hatası:`, error.message);
            }
        }

        // Hisse'leri analiz et
        for (const stock of analysisList.stocks) {
            try {
                const stockData = await getStockPrice(stock);
                if (stockData && stockData.changePercent > bestStock.change) {
                    bestStock = { 
                        name: stock,
                        symbol: stock,
                        change: stockData.changePercent,
                        price: stockData.price,
                        company: stockData.name
                    };
                }
                // 1 saniye bekle (API limiti için)
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.log(`⚠️ ${stock} analiz hatası:`, error.message);
            }
        }

        console.log('✅ Haftalık analiz tamamlandı:', { bestCrypto, bestStock });
        return { bestCrypto, bestStock };

    } catch (error) {
        console.error('❌ Haftalık analiz hatası:', error);
        // Fallback veriler
        return {
            bestCrypto: { name: 'solana', change: 8.5, price: 172 },
            bestStock: { name: 'MicroStrategy', symbol: 'MSTR', change: 6.2, price: 685.50, company: 'MicroStrategy' }
        };
    }
}

// AI ile haftalık analiz yap
async function getWeeklyAIAnalysis(cryptoData, stockData) {
    if (!model) {
        return `📈 **HAFTALIK PATLAMA POTANSİYELİ ANALİZİ**\n\n` +
               `💰 **Kripto:** ${cryptoData.name.toUpperCase()}\n` +
               `   📊 Değişim: %${cryptoData.change.toFixed(2)}\n` +
               `   💵 Fiyat: $${cryptoData.price?.toLocaleString()}\n\n` +
               `📈 **Hisse:** ${stockData.company} (${stockData.symbol})\n` +
               `   📊 Değişim: %${stockData.change.toFixed(2)}\n` +
               `   💵 Fiyat: $${stockData.price?.toLocaleString()}\n\n` +
               `⚠️ AI şu anda kullanılamıyor.`;
    }

    try {
        const prompt = `
        Haftalık kripto para ve hisse senedi analizi yap. Aşağıdaki verilere göre patlama potansiyeli en yüksek iki varlığı değerlendir:
        
        **KRİPTO:** ${cryptoData.name.toUpperCase()}
        - Son 24s Değişim: %${cryptoData.change.toFixed(2)}
        - Mevcut Fiyat: $${cryptoData.price?.toLocaleString()}
        
        **HİSSE:** ${stockData.company} (${stockData.symbol})
        - Son Değişim: %${stockData.change.toFixed(2)}
        - Mevcut Fiyat: $${stockData.price?.toLocaleString()}
        
        Her biri için:
        1. Kısa teknik analiz
        2. Patlama potansiyeli nedenleri
        3. Risk faktörleri
        4. Yatırımcı önerileri
        
        Maksimum 300 kelime. Türkçe ve profesyonel bir dil kullan.
        `;

        const result = await model.generateContent(prompt);
        const analysis = result.response.text();
        
        return `📈 **HAFTALIK PATLAMA POTANSİYELİ ANALİZİ**\n\n${analysis}\n\n` +
               `💎 **Özet:**\n` +
               `• ${cryptoData.name.toUpperCase()}: %${cryptoData.change.toFixed(2)} 📈\n` +
               `• ${stockData.symbol}: %${stockData.change.toFixed(2)} 📈\n\n` +
               `⚠️ *Yatırım tavsiyesi değildir. Kendi araştırmanızı yapın.*`;
        
    } catch (error) {
        console.error('AI haftalık analiz hatası:', error);
        return `📈 **HAFTALIK PATLAMA POTANSİYELİ ANALİZİ**\n\n` +
               `💰 **${cryptoData.name.toUpperCase()}** en yüksek potansiyele sahip!\n` +
               `📊 Son 24s: %${cryptoData.change.toFixed(2)} değişim\n\n` +
               `📈 **${stockData.company} (${stockData.symbol})** hissesi öne çıkıyor!\n` +
               `📊 Son değişim: %${stockData.change.toFixed(2)}\n\n` +
               `🔍 Detaylı analiz için @CryptoStockAIBot`;
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

// Haftalık analizi kanala gönder
async function sendWeeklyAnalysisToChannel() {
    try {
        console.log('🔄 Haftalık analiz kanala gönderiliyor...');
        
        const weeklyData = await getWeeklyExplosionPotential();
        const analysis = await getWeeklyAIAnalysis(weeklyData.bestCrypto, weeklyData.bestStock);
        
        const success = await sendToChannel(analysis);
        if (success) {
            console.log('✅ Haftalık analiz kanala gönderildi');
            return true;
        }
        return false;
    } catch (error) {
        console.error('❌ Haftalık analiz gönderim hatası:', error);
        return false;
    }
}

// Günlük market özeti gönder
async function sendDailyMarketUpdate() {
    try {
        const cryptoCoins = ['bitcoin', 'ethereum'];
        const stocks = ['AAPL', 'TSLA'];
        
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

// OTOMATİK MESAJ AYARLARI
function startAutoChannelPosts() {
    console.log('🔄 Otomatik kanal mesajları başlatılıyor...');
    
    // Her Pazartesi saat 10:00'da haftalık analiz
    setInterval(async () => {
        try {
            const now = new Date();
            if (now.getDay() === 1 && now.getHours() === 10 && now.getMinutes() === 0) {
                console.log('📅 Pazartesi haftalık analiz gönderiliyor...');
                await sendWeeklyAnalysisToChannel();
            }
        } catch (error) {
            console.error('Otomatik haftalık analiz hatası:', error);
        }
    }, 60000); // Her dakika kontrol

    // Her gün saat 09:00'da market özeti
    setInterval(async () => {
        try {
            const now = new Date();
            if (now.getHours() === 9 && now.getMinutes() === 0) {
                console.log('🌅 Günlük market özeti gönderiliyor...');
                await sendDailyMarketUpdate();
            }
        } catch (error) {
            console.error('Otomatik market özeti hatası:', error);
        }
    }, 60000);

    console.log('✅ Otomatik mesajlar başlatıldı');
}

// Ana menü
const mainMenu = Markup.keyboard([
    ['💰 Bitcoin', '🌐 Ethereum', '🚀 Trend'],
    ['📈 AAPL', '📈 TSLA', '📈 NVDA'],
    ['🤖 AI Analiz', '📊 Haftalık', '🎯 Kanal'],
    ['ℹ️ Yardım', '📢 Kanal Komutları']
]).resize();

// /start komutu
bot.start((ctx) => {
    const welcomeMessage = `🤖 **AI Crypto & Hisse Bot'a Hoşgeldiniz!**

✨ **Özellikler:**
• 💰 Gerçek zamanlı kripto fiyatları
• 📈 Gerçek zamanlı hisse fiyatları
• 🤖 AI destekli analizler
• 📊 Haftalık patlama potansiyeli analizi
• 🎯 Otomatik kanal güncellemeleri

**📢 KANAL KULLANIMI:**
Kanalınızda beni etiketleyerek kullanın:
\`@CryptoStockAIBot /stock AAPL\`
\`@CryptoStockAIBot /ai crypto bitcoin\`
\`@CryptoStockAIBot /trend\`

**Komutlar butonlarda veya /help yazın!**`;

    ctx.reply(welcomeMessage, {
        parse_mode: 'Markdown',
        ...mainMenu
    });
});

// Yardım komutu
bot.command('help', (ctx) => {
    ctx.reply(`🤖 **KULLANIM KILAVUZU**

**📊 TEMEL KOMUTLAR:**
/bitcoin - Bitcoin fiyatı
/ethereum - Ethereum fiyatı  
/stock AAPL - Hisse fiyatı
/trend - Trend coinler

**🤖 AI ANALİZ:**
/ai crypto bitcoin - Bitcoin analizi
/ai stock AAPL - Hisse analizi

**🎯 KANAL KOMUTLARI:**
/weekly - Haftalık analiz (kanala gönder)
/daily - Günlük özet (kanala gönder)
/post <mesaj> - Kanal mesajı gönder

**📢 KANALDA KULLANIM:**
\`@CryptoStockAIBot /stock TSLA\`
\`@CryptoStockAIBot /ai crypto solana\`

💎 **Kanal:** ${process.env.CHANNEL_USERNAME || '@coinvekupon'}`,
    { parse_mode: 'Markdown' });
});

// HAFTALIK ANALİZ KOMUTU
bot.command('weekly', async (ctx) => {
    await ctx.sendChatAction('typing');
    
    try {
        ctx.reply('📈 Haftalık patlama potansiyeli analiz ediliyor...');
        
        const weeklyData = await getWeeklyExplosionPotential();
        const analysis = await getWeeklyAIAnalysis(weeklyData.bestCrypto, weeklyData.bestStock);
        
        // Kullanıcıya göster
        await ctx.reply(analysis, { parse_mode: 'Markdown' });
        
        // Kanal'a da gönder
        const success = await sendToChannel(analysis);
        if (success) {
            ctx.reply('✅ Haftalık analiz kanala da gönderildi!');
        }
        
    } catch (error) {
        console.error('Weekly komut hatası:', error);
        ctx.reply('❌ Haftalık analiz sırasında hata oluştu.');
    }
});

// Günlük özet komutu
bot.command('daily', async (ctx) => {
    try {
        const success = await sendDailyMarketUpdate();
        if (success) {
            ctx.reply('✅ Günlük özet kanala gönderildi!');
        } else {
            ctx.reply('❌ Günlük özet gönderilemedi.');
        }
    } catch (error) {
        console.error('Daily komut hatası:', error);
        ctx.reply('❌ Günlük özet gönderilirken hata oluştu.');
    }
});

// Kanal mesajı komutu
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

// Diğer komutlar (kısa versiyon)
bot.command('bitcoin', async (ctx) => {
    await ctx.sendChatAction('typing');
    const btcPrice = await getCryptoPrice('bitcoin');
    ctx.reply(`💰 Bitcoin: $${btcPrice.usd?.toLocaleString()} (${btcPrice.usd_24h_change?.toFixed(2)}%)`);
});

bot.command('stock', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('❌ Hisse sembolü girin: /stock AAPL');
    
    const symbol = args[1].toUpperCase();
    await ctx.sendChatAction('typing');
    const stockData = await getStockPrice(symbol);
    ctx.reply(`📈 ${stockData.name}: $${stockData.price?.toLocaleString()} (${stockData.changePercent?.toFixed(2)}%)`);
});

// Buton işlemleri
bot.hears('📊 Haftalık', async (ctx) => {
    await ctx.sendChatAction('typing');
    ctx.reply('📈 Haftalık analiz için: /weekly\n\nBu komut hem size hem de kanala analiz gönderir.');
});

bot.hears('🎯 Kanal', (ctx) => {
    ctx.reply(`📢 **KANAL KULLANIMI**

**Kanalınızda beni etiketleyin:**
\`@CryptoStockAIBot /stock AAPL\`
\`@CryptoStockAIBot /ai crypto bitcoin\`  
\`@CryptoStockAIBot /trend\`

**Yönetici Komutları:**
/weekly - Haftalık analiz
/daily - Günlük özet
/post - Mesaj gönder

💎 Kanal: ${process.env.CHANNEL_USERNAME || '@coinvekupon'}`,
    { parse_mode: 'Markdown' });
});

// Botu başlat
console.log('=== BOT BAŞLATILIYOR ===');

bot.launch()
    .then(() => {
        console.log('✅ Bot başarıyla çalışıyor!');
        console.log('📢 Kanal:', process.env.CHANNEL_USERNAME || '@coinvekupon');
        console.log('🤖 AI Durumu:', model ? 'Aktif' : 'Devre Dışı');
        
        // Otomatik mesajları başlat
        setTimeout(() => {
            startAutoChannelPosts();
        }, 10000);
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
