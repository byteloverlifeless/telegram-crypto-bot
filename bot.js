// Gerekli kütüphaneleri ve ayarları içeri aktar
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

// --- API ANAHTARLARINI VE AYARLARI ORTAM DEĞİŞKENLERİNDEN ALMA ---
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const geminiApiKey = process.env.GEMINI_API_KEY;
const finnhubApiKey = process.env.FINNHUB_API_KEY; // Finnhub API anahtarını kullanıyoruz

// Gerekli API anahtarları eksikse programı hata vererek durdur.
if (!telegramToken || !geminiApiKey || !finnhubApiKey) {
    console.error("Hata: Gerekli API anahtarları (Telegram, Gemini, Finnhub) .env dosyasında veya ortam değişkenlerinde tanımlanmamış.");
    process.exit(1); // Programdan çık
}

// --- API İSTEMCİLERİNİ BAŞLATMA ---
const bot = new TelegramBot(telegramToken, { polling: true });
const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

console.log("✅ Telegram Finans Botu (Finnhub Entegrasyonu) başarıyla başlatıldı...");

// --- VERİ ÇEKME FONKSİYONLARI (FINNHUB KULLANILARAK) ---

/**
 * Finnhub API'sinden hisse senedi verilerini çeker.
 * @param {string} symbol Hisse senedi sembolü (örn: "AAPL").
 * @returns {Promise<object|null>} Hisse senedi verilerini veya hata durumunda null döner.
 */
async function getStockData(symbol) {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol.toUpperCase()}&token=${finnhubApiKey}`;
    try {
        const response = await axios.get(url);
        const data = response.data;
        if (data && data.c !== 0) { // 'c' (current price) 0 ise veri yoktur.
            return {
                sembol: symbol.toUpperCase(),
                fiyat: data.c.toFixed(2),
                degisim: data.d.toFixed(2),
                degisimYuzde: data.dp.toFixed(2)
            };
        }
        return null;
    } catch (error) {
        console.error(`Finnhub hisse senedi verisi alınırken hata (${symbol}):`, error.message);
        return null;
    }
}

/**
 * Finnhub API'sinden kripto para verilerini çeker.
 * @param {string} symbol Kripto para sembolü (örn: "BTC").
 * @returns {Promise<object|null>} Kripto para verilerini veya hata durumunda null döner.
 */
async function getCryptoData(symbol) {
    // Finnhub formatı: BINANCE:BTCUSDT
    const finnhubSymbol = `BINANCE:${symbol.toUpperCase()}USDT`;
    const url = `https://finnhub.io/api/v1/quote?symbol=${finnhubSymbol}&token=${finnhubApiKey}`;
    try {
        const response = await axios.get(url);
        const data = response.data;
         if (data && data.c !== 0) {
            return {
                id: symbol.toUpperCase(),
                fiyat: data.c.toFixed(2),
                degisim: data.d.toFixed(2),
                degisimYuzde: data.dp.toFixed(2)
            };
        }
        return null;
    } catch (error) {
        console.error(`Finnhub kripto para verisi alınırken hata (${symbol}):`, error.message);
        return null;
    }
}

// --- TELEGRAM BOTUNUN MESAJ DİNLEYİCİSİ ---
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userInput = msg.text;

    if (!userInput || msg.from.is_bot) return;

    if (userInput.startsWith('/start') || userInput.startsWith('/help')) {
        const helpMessage = `
Merhaba! Ben Finnhub ve Gemini destekli bir finans botuyum. 🤖

Güncel hisse senedi veya kripto para bilgisi almak için bana bir soru sorman yeterli.

Örnekler:
- \`Bitcoin fiyatı ne kadar?\`
- \`TSLA hissesi son durum\`
- \`Ethereum\` ya da \`ETH\`
- \`GOOGL\`
        `;
        bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
        return;
    }

    try {
        const processingMessage = await bot.sendMessage(chatId, "Analiz ediliyor ve veriler getiriliyor, lütfen bekleyin... 🧠");

        // ADIM 1: Gemini'den kullanıcının girdisini analiz etmesini iste.
        // Kripto için sadece sembolü (BTC, ETH) almasını istiyoruz.
        const promptForAnalysis = `
            Kullanıcı girdisini analiz et ve bana sadece ve sadece JSON formatında bir cevap ver. Girdinin ne hakkında olduğunu (hisse senedi mi, kripto para mı) ve ilgili sembolü/ID'yi belirle.
            Kullanıcı Girdisi: "${userInput}"
            
            Örnek Cevaplar:
            - 'Tesla hissesi' -> {"type": "stock", "symbol": "TSLA"}
            - 'Bitcoin fiyatı nedir' -> {"type": "crypto", "symbol": "BTC"}
            - 'ethereum' -> {"type": "crypto", "symbol": "ETH"}
            - 'GOOGL' -> {"type": "stock", "symbol": "GOOGL"}
            - Anlaşılmazsa -> {"type": "unknown", "symbol": null}
        `;
        const analysisResult = await model.generateContent(promptForAnalysis);
        const analysisText = analysisResult.response.text().replace(/```json|```/g, '').trim();
        const analysis = JSON.parse(analysisText);

        let financialData;

        // ADIM 2: Analiz sonucuna göre ilgili API'den veriyi çek.
        if (analysis.type === 'stock' && analysis.symbol) {
            financialData = await getStockData(analysis.symbol);
        } else if (analysis.type === 'crypto' && analysis.symbol) {
            financialData = await getCryptoData(analysis.symbol);
        } else {
            bot.editMessageText("Üzgünüm, isteğinizi anlayamadım. Lütfen 'BTC fiyatı' veya 'AAPL hissesi' gibi daha net bir ifade kullanın.", {
                chat_id: chatId,
                message_id: processingMessage.message_id
            });
            return;
        }

        if (!financialData) {
            bot.editMessageText(`Maalesef \`${analysis.symbol}\` için veri bulunamadı. Lütfen sembolü kontrol edip tekrar deneyin. (Örn: Hisse için GOOGL, Kripto için BTC)`, {
                chat_id: chatId,
                message_id: processingMessage.message_id,
                parse_mode: 'Markdown'
            });
            return;
        }
        
        // ADIM 3: Alınan verileri Gemini ile kullanıcı dostu bir metne dönüştür.
        const promptForResponse = `
            Aşağıdaki finansal verileri kullanarak, sanki bir finans asistanıymışsın gibi, pozitif ve bilgilendirici bir dilde, Türkçe bir cevap metni oluştur. Fiyatı dolar ($) olarak belirt. Değişim yüzdesini emoji (artış için 📈, düşüş için 📉, değişiklik yoksa ➖) ile göster.
            Veri: ${JSON.stringify(financialData)}
        `;
        const finalResult = await model.generateContent(promptForResponse);
        const finalResponse = finalResult.response.text();

        // ADIM 4: Sonucu kullanıcıya gönder.
        bot.editMessageText(finalResponse, {
            chat_id: chatId,
            message_id: processingMessage.message_id
        });

    } catch (error) {
        console.error("İşlem sırasında bir hata oluştu:", error);
        bot.sendMessage(chatId, "⚠️ Bir hata oluştu. Lütfen daha sonra tekrar deneyin veya isteğinizi farklı bir şekilde ifade edin.");
    }
});
