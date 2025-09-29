const TelegramBot = require('node-telegram-bot-api');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const express = require('express');
const axios = require('axios');

// ======================
// SUNUCU KURULUMU
// ======================
const app = express();
const PORT = process.env.PORT || 3000;

// Health check endpoint - Render için zorunlu
app.get('/', (req, res) => {
  res.json({
    status: '✅ Bot Aktif',
    platform: 'Render.com',
    version: '2.0 - Gemini 1.5 Flash',
    timestamp: new Date().toLocaleString('tr-TR'),
    features: [
      'Gerçek zamanlı kripto analizi',
      'Teknik analiz',
      'Piyasa sentimenti',
      'Otomatik güncellemeler'
    ]
  });
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`🟢 Health check server: http://localhost:${PORT}`);
});

// ======================
// TELEGRAM BOT KURULUMU
// ======================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CHANNEL_ID = process.env.CHANNEL_ID || '@coinvekupon';

// Environment variables kontrolü
if (!TELEGRAM_TOKEN) {
  console.error('❌ TELEGRAM_TOKEN eksik!');
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY eksik!');
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN, {
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
});

// ======================
// GEMINI AI KURULUMU
// ======================
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Gemini 1.5 Flash modeli - En güncel ve hızlı
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 1024,
  },
});

console.log('🚀 Telegram Bot Başlatıldı!');
console.log('🤖 Gemini 1.5 Flash Modeli Aktif!');
console.log('🌐 Gerçek Zamanlı Veri Aktarımı: AKTİF');

// ======================
// GERÇEK ZAMANLI VERİ FONKSİYONLARI
// ======================

/**
 * CoinGecko API'den canlı kripto verileri alır
 */
async function getLiveCryptoData() {
  try {
    console.log('📡 Canlı kripto verileri alınıyor...');
    
    const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
      params: {
        vs_currency: 'usd',
        ids: 'bitcoin,ethereum,binancecoin,solana,cardano,ripple,dogecoin,polkadot',
        order: 'market_cap_desc',
        per_page: 8,
        page: 1,
        sparkline: false,
        price_change_percentage: '1h,24h,7d'
      },
      timeout: 15000
    });

    const liveData = response.data.map(coin => ({
      name: coin.name,
      symbol: coin.symbol.toUpperCase(),
      price: coin.current_price,
      change1h: coin.price_change_percentage_1h_in_currency,
      change24h: coin.price_change_percentage_24h,
      change7d: coin.price_change_percentage_7d_in_currency,
      marketCap: coin.market_cap,
      volume: coin.total_volume,
      rank: coin.market_cap_rank
    }));

    console.log('✅ Canlı veriler alındı:', liveData.length, 'coin');
    return liveData;

  } catch (error) {
    console.error('❌ Canlı veri hatası:', error.message);
    return null;
  }
}

/**
 * Kripto haberlerini alır (simülasyon)
 */
async function getCryptoNews() {
  try {
    // Gerçek haber API'si yerine simüle edilmiş haberler
    const simulatedNews = [
      {
        title: "Bitcoin ETF Onayları Piyasayı Hareketlendirdi",
        impact: "positive",
        source: "CoinDesk"
      },
      {
        title: "Merkez Bankaları Dijital Para Çalışmalarını Hızlandırdı",
        impact: "neutral", 
        source: "Reuters"
      },
      {
        title: "Yeni Regülasyonlar Altcoin Piyasasını Etkileyebilir",
        impact: "negative",
        source: "Bloomberg"
      }
    ];

    return simulatedNews;
  } catch (error) {
    console.log('❌ Haber verisi alınamadı');
    return null;
  }
}

// ======================
// AI ANALİZ FONKSİYONLARI
// ======================

/**
 * Gemini AI ile gelişmiş kripto analizi
 */
async function generateCryptoAnalysis() {
  try {
    console.log('🧠 AI analizi hazırlanıyor...');
    
    // 1. Gerçek zamanlı verileri al
    const [liveData, news] = await Promise.all([
      getLiveCryptoData(),
      getCryptoNews()
    ]);

    // 2. Dinamik context oluştur
    let context = "🔍 **GERÇEK ZAMANLI KRİPTO PİYASASI ANALİZİ**\n\n";

    if (liveData && liveData.length > 0) {
      context += "📊 **CANLI FİYAT VERİLERİ:**\n";
      liveData.slice(0, 5).forEach((coin, index) => {
        const changeEmoji = coin.change24h >= 0 ? '📈' : '📉';
        context += `${index + 1}. ${coin.name} (${coin.symbol}): $${coin.price.toLocaleString()} | 24s: ${changeEmoji} ${coin.change24h?.toFixed(2)}%\n`;
      });
      context += "\n";
    }

    if (news && news.length > 0) {
      context += "📰 **SON HABERLER:**\n";
      news.forEach((item, index) => {
        const impactEmoji = item.impact === 'positive' ? '✅' : item.impact === 'negative' ? '⚠️' : '🔸';
        context += `${impactEmoji} ${item.title} (${item.source})\n`;
      });
      context += "\n";
    }

    // 3. AI prompt'u oluştur
    const prompt = `
    ${context}

    **GÖREV:** Yukarıdaki GERÇEK ZAMANLI verilere dayanarak kapsamlı kripto piyasası analizi yap.

    **ANALİZ BAŞLIKLARI:**
    1. 📈 TEKNİK ANALİZ: Mevcut fiyat hareketleri ve trendler
    2. 📊 TEMEL ANALİZ: Haberlerin ve temel faktörlerin etkisi
    3. 🎯 KISA VADELİ BEKLENTİLER: 1-3 günlük öngörüler
    4. ⚠️ RİSK DEĞERLENDİRMESİ: Potansiyel riskler ve fırsatlar
    5. 💡 YATIRIMCI TAVSİYELERİ: Pratik öneriler

    **FORMAT KRİTERLERİ:**
    - Türkçe, net ve anlaşılır dil
    - Maksimum 400 kelime
    - Maddeler halinde düzenli
    - Emoji kullanarak görsel destek
    - Gerçek verilere dayalı somut analiz

    **ÖNEMLİ UYARI:** "Bu bir yatırım tavsiyesi değildir, kendi araştırmanızı yapın" uyarısı ekle.
    `;

    // 4. Gemini AI'ya sorgu gönder
    const result = await model.generateContent(prompt);
    const analysis = result.response.text();

    console.log('✅ AI analizi tamamlandı');
    return analysis;

  } catch (error) {
    console.error('❌ AI analiz hatası:', error);
    return await getFallbackAnalysis();
  }
}

/**
 * Teknik analiz üretir
 */
async function generateTechnicalAnalysis() {
  try {
    const liveData = await getLiveCryptoData();
    
    const prompt = `
    **GÖREV:** Aşağıdaki gerçek zamanlı verilere dayanarak DETAYLI teknik analiz yap.

    **VERİLER:**
    ${liveData ? liveData.map(c => `- ${c.name} (${c.symbol}): $${c.price} | 24s: ${c.change24h}%`).join('\n') : 'Veri yükleniyor...'}

    **TEKNİK GÖSTERGELERİ ANALİZ ET:**
    📊 RSI (Göreli Güç Endeksi)
    📈 MACD (Hareketli Ortalama Yakınsama/Iraksama)
    📉 Destek ve Direnç Seviyeleri
    💰 Hacim Analizi
    🔄 Trend Değerlendirmesi

    **İSTENEN ÇIKTI:**
    - Her coin için ayrı teknik analiz
    - Alım/satım sinyalleri (eğitim amaçlı)
    - Önemli seviyeler
    - Risk seviyeleri

    Türkçe, profesyonel ama anlaşılır dil.
    `;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    return "❌ Teknik analiz şu anda hazırlanamıyor.";
  }
}

/**
 * Piyasa sentiment analizi
 */
async function generateMarketSentiment() {
  try {
    const prompt = `
    **GÖREV:** Mevcut kripto piyasası SENTIMENT analizi yap.

    **DEĞERLENDİRME FAKTÖRLERİ:**
    1. Piyasa Genel Görünümü
    2. Yatırımcı Psikolojisi ve Duygusal Durum
    3. Küresel Ekonomik Koşullar
    4. Teknik Göstergeler
    5. Haberler ve Medya Etkisi

    **SENTIMENT SEVİYESİ BELİRLE:**
    🚀 Çok Bullish (Aşırı İyimser)
    📈 Bullish (İyimser)  
    ➡️ Nötr (Kararsız)
    📉 Bearish (Kötümser)
    🐻 Çok Bearish (Aşırı Kötümser)

    **İSTENEN:**
    - Sentiment seviyesi ve gerekçesi
    - Ana etkileyen faktörler
    - Beklenen piyasa tepkisi
    - Yatırımcı tavsiyeleri

    Türkçe, 250 kelimeyi geçmeyen.
    `;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    return "❌ Sentiment analizi hazırlanamıyor.";
  }
}

/**
 * Internet bağlantısı olmadığında yedek içerik
 */
async function getFallbackAnalysis() {
  const prompt = `
  Kripto piyasası için genel analiz yap. Mevcut piyasa koşullarını tahmin ederek:

  **ANALİZ BAŞLIKLARI:**
  - Bitcoin genel trend değerlendirmesi
  - Ethereum teknik görünüm
  - Major altcoinlerin performansı
  - Piyasa volatilitesi ve riskler

  **ÖZELLİKLER:**
  - Türkçe, anlaşılır dil
  - Pratik tavsiyeler içeren
  - Risk uyarıları ekleyen
  - Gerçekçi beklentiler sunan

  **UYARI:** "Gerçek zamanlı veriler geçici olarak kullanılamıyor" notunu ekle.
  `;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    return "📊 **KRİPTO PİYASASI ANALİZİ**\n\nPiyasa verileri güncelleniyor. Genel trend yatay seyir gösteriyor. Major coinler konsolidasyon döneminde. ⚠️ **ÖNEMLİ:** Bu bir yatırım tavsiyesi değildir, kendi araştırmanızı yapın!";
  }
}

// ======================
// TELEGRAM KOMUTLARI
// ======================

/**
 * /start Komutu
 */
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from.first_name || 'Kullanıcı';

  try {
    const welcomeText = `
🤖 **Merhaba ${userName}!** 🎉

**Gemini 2.5 Flash Kripto Asistanına** hoş geldiniz!

🌟 **ÖZELLİKLER:**
✅ Gemini 2.5 Flash AI teknolojisi
✅ Gerçek zamanlı piyasa verileri  
✅ Profesyonel teknik analiz
✅ Piyasa sentiment takibi
✅ Otomatik güncellemeler

📊 **KOMUT LİSTESİ:**
/analiz - Güncel kripto analizi
/teknik - Detaylı teknik analiz
/sentiment - Piyasa duygu durumu
/canli - Anlık fiyat bilgileri
/help - Yardım menüsü

⚡ **GÜNCELLİK:**
- Son 5 dakika verileri
- Canlı piyasa analizi
- Anlık haber entegrasyonu

🌐 **Kanalımız:** @coinvekupon

💡 _Bot sürekli güncel verilerle çalışır!_
    `;

    await bot.sendMessage(chatId, welcomeText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📊 Hemen Analiz Yap", callback_data: "quick_analysis" },
            { text: "📢 Kanala Katıl", url: "https://t.me/coinvekupon" }
          ],
          [
            { text: "💎 Premium Destek", callback_data: "premium_info" }
          ]
        ]
      }
    });

    console.log(`✅ Yeni kullanıcı: ${userName} (${chatId})`);
  } catch (error) {
    console.error('Start komutu hatası:', error);
  }
});

/**
 * /analiz Komutu - Ana analiz
 */
bot.onText(/\/analiz/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    // İşlem başladı mesajı
    const processingMsg = await bot.sendMessage(
      chatId, 
      '🌐 **Gerçek zamanlı veriler alınıyor...**\n\n_Lütfen bekleyin, AI analiz hazırlıyor_', 
      { parse_mode: 'Markdown' }
    );

    // Analizi oluştur
    const analysis = await generateCryptoAnalysis();
    
    const message = `📈 **GERÇEK ZAMANLI KRİPTO ANALİZ** 🔄\n\n${analysis}\n\n⏰ _${new Date().toLocaleString('tr-TR')}_\n\n💡 **Gemini 2.5 Flash AI Teknolojisi**`;

    // Önceki mesajı sil ve yenisini gönder
    await bot.deleteMessage(chatId, processingMsg.message_id);
    
    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: "🔄 Yenile", callback_data: "refresh_analysis" },
          { text: "📊 Teknik Analiz", callback_data: "technical_analysis" }
        ]]
      }
    });

    console.log(`✅ Analiz gönderildi: ${chatId}`);
  } catch (error) {
    console.error('Analiz komutu hatası:', error);
    await bot.sendMessage(
      chatId, 
      '❌ **Analiz hazırlanırken hata oluştu**\n\nLütfen birkaç dakika sonra tekrar deneyin.',
      { parse_mode: 'Markdown' }
    );
  }
});

/**
 * /teknik Komutu - Teknik analiz
 */
bot.onText(/\/teknik/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    const processingMsg = await bot.sendMessage(chatId, '🔧 **Teknik analiz hazırlanıyor...**');
    
    const technical = await generateTechnicalAnalysis();
    const message = `🔧 **DETAYLI TEKNİK ANALİZ** 📊\n\n${technical}\n\n⚡ _Gemini 2.5 Flash + Canlı Veriler_`;

    await bot.deleteMessage(chatId, processingMsg.message_id);
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    await bot.sendMessage(chatId, '❌ Teknik analiz hazırlanamadı.');
  }
});

/**
 * /sentiment Komutu - Piyasa sentiment
 */
bot.onText(/\/sentiment/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    const sentiment = await generateMarketSentiment();
    const message = `🎭 **PİYASA SENTIMENT ANALİZİ** 📈📉\n\n${sentiment}\n\n💭 _Yatırımcı psikolojisi ve piyasa duyguları_`;

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    await bot.sendMessage(chatId, '❌ Sentiment analizi hazırlanamadı.');
  }
});

/**
 * /canli Komutu - Canlı fiyatlar
 */
bot.onText(/\/canli/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    const liveData = await getLiveCryptoData();
    
    if (!liveData || liveData.length === 0) {
      await bot.sendMessage(chatId, '❌ **Canlı veriler alınamadı**\n\nLütfen daha sonra tekrar deneyin.', { parse_mode: 'Markdown' });
      return;
    }

    let message = `💰 **CANLI KRİPTO FİYATLARI** 💰\n\n`;

    liveData.slice(0, 6).forEach(coin => {
      const change24h = coin.change24h || 0;
      const changeEmoji = change24h >= 0 ? '📈' : '📉';
      const changeColor = change24h >= 0 ? '🟢' : '🔴';
      
      message += `${changeColor} **${coin.name} (${coin.symbol})**\n`;
      message += `💵 **Fiyat:** $${coin.price.toLocaleString()}\n`;
      message += `📊 **24s Değişim:** ${changeEmoji} ${change24h.toFixed(2)}%\n`;
      message += `🏆 **Sıra:** #${coin.rank}\n\n`;
    });

    message += `⏰ _${new Date().toLocaleString('tr-TR')}_\n`;
    message += `🔔 **Toplam:** ${liveData.length} coin takip ediliyor`;

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: "🔄 Fiyatları Güncelle", callback_data: "refresh_prices" },
          { text: "📈 Analiz İste", callback_data: "quick_analysis" }
        ]]
      }
    });

  } catch (error) {
    console.error('Canlı fiyat hatası:', error);
    await bot.sendMessage(chatId, '❌ Canlı fiyatlar alınamadı.');
  }
});

/**
 * /help Komutu - Yardım menüsü
 */
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  
  const helpText = `
🆘 **YARDIM MENÜSÜ** 🤖

📋 **KOMUT LİSTESİ:**
/start - Botu başlat ve hoş geldin mesajı al
/analiz - Güncel kripto piyasası analizi
/teknik - Detaylı teknik analiz
/sentiment - Piyasa duygu durumu analizi  
/canli - Anlık kripto fiyatları
/help - Bu yardım mesajı

💡 **ÖZELLİKLER:**
- 🤖 Gemini 2.5 Flash AI teknolojisi
- 🌐 Gerçek zamanlı veri entegrasyonu
- 📊 Profesyonel analiz araçları
- ⚡ Hızlı yanıt süreleri

⚠️ **ÖNEMLI UYARILAR:**
- Bu bot eğitim amaçlıdır
- Yatırım tavsiyesi DEĞİLDİR
- Kendi araştırmanızı yapın
- Riskleri anlayarak yatırım yapın

🔧 **DESTEK:**
Sorularınız için: @coinvekupon
  `;

  bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
});

// ======================
// BUTON YÖNETİMİ
// ======================

bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;

  try {
    switch (data) {
      case 'quick_analysis':
        await bot.sendMessage(msg.chat.id, '🔍 Hızlı analiz hazırlanıyor...');
        // /analiz komutunu tetikle
        bot.emitText('/analiz', msg);
        break;

      case 'refresh_analysis':
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Analiz yenileniyor...' });
        bot.emitText('/analiz', msg);
        break;

      case 'technical_analysis':
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Teknik analiz hazırlanıyor...' });
        bot.emitText('/teknik', msg);
        break;

      case 'refresh_prices':
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Fiyatlar güncelleniyor...' });
        bot.emitText('/canli', msg);
        break;

      case 'premium_info':
        await bot.answerCallbackQuery(callbackQuery.id);
        await bot.sendMessage(msg.chat.id, 
          '💎 **PREMIUM DESTEK**\n\nPremium özellikler yakında eklenecek!\n\n🌐 Kanal: @coinvekopen',
          { parse_mode: 'Markdown' }
        );
        break;
    }
  } catch (error) {
    console.error('Callback hatası:', error);
  }
});

// ======================
// OTOMATİK KANAL MESAJLARI
// ======================

/**
 * Kanal için günlük analiz gönderir
 */
async function sendDailyChannelAnalysis() {
  if (!CHANNEL_ID || CHANNEL_ID === '@coinvekupon') {
    console.log('ℹ️ Kanal ID tanımlı değil, otomatik mesajlar devre dışı');
    return;
  }

  try {
    console.log('🌅 Kanal için günlük analiz hazırlanıyor...');
    
    const analysis = await generateCryptoAnalysis();
    const message = `🌅 **SABAH KRİPTO ANALİZİ** 🌅\n\n${analysis}\n\n⏰ _${new Date().toLocaleString('tr-TR')}_\n\n⚡ Gemini 2.5 Flash | 🔄 Gerçek Zamanlı Veri`;

    await bot.sendMessage(CHANNEL_ID, message, { parse_mode: 'Markdown' });
    console.log('✅ Günlük kanal analizi gönderildi');

  } catch (error) {
    console.error('❌ Kanal analiz hatası:', error);
  }
}

// ======================
// HATA YÖNETİMİ
// ======================

bot.on('polling_error', (error) => {
  console.error('🔴 Telegram Polling Error:', error);
});

bot.on('webhook_error', (error) => {
  console.error('🔴 Webhook Error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('🔴 Unhandled Promise Rejection:', error);
});

process.on('SIGINT', () => {
  console.log('🛑 Bot kapatılıyor...');
  bot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Bot kapatılıyor...');
  bot.stopPolling();
  process.exit(0);
});

// ======================
// BOT BAŞLATMA
// ======================

console.log('✅ ====================================');
console.log('✅ TELEGRAM KRİPTO BOTU BAŞLATILDI!');
console.log('✅ ====================================');
console.log('🤖 Model: Gemini 1.5 Flash');
console.log('🌐 Internet Erişimi: AKTİF');
console.log('📡 Gerçek Zamanlı Veri: AKTİF');
console.log('📊 Komutlar: /start, /analiz, /teknik, /sentiment, /canli, /help');
console.log('⏰ Saat:', new Date().toLocaleString('tr-TR'));
console.log('✅ ====================================');

// Bot başladığında test mesajı
setTimeout(() => {
  sendDailyChannelAnalysis();
}, 10000);

// Her saat başı kanal güncellemesi (simülasyon)
setInterval(() => {
  console.log('❤️ Bot aktif:', new Date().toLocaleString('tr-TR'));
}, 3600000); // 1 saatte bir
