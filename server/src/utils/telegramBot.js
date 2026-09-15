// Thin wrapper around Telegram's Bot API -- plain HTTPS calls (Node's global
// fetch), no SDK needed for something this small. Real network calls are
// skipped in tests the same way rateLimiters.js skips rate limiting in
// tests: nothing here should ever hit the real API during a Jest run.
const callTelegram = async (method, payload) => {
  if (process.env.NODE_ENV === "test") return { ok: true, skipped: true };

  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
};

// inlineKeyboard is a Telegram inline_keyboard array of rows, e.g.
// [[{ text: "Accept", callback_data: "acc:<id>" }, ...]] -- optional.
const sendTelegramMessage = (chatId, text, inlineKeyboard) =>
  callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: inlineKeyboard ? { inline_keyboard: inlineKeyboard } : undefined,
  });

// Telegram shows a loading spinner on a tapped inline button until this is
// called -- also the only way to show the small toast-style confirmation.
const answerCallbackQuery = (callbackQueryId, text) =>
  callTelegram("answerCallbackQuery", { callback_query_id: callbackQueryId, text });

const registerWebhook = (url, secretToken) => callTelegram("setWebhook", { url, secret_token: secretToken });

module.exports = { sendTelegramMessage, answerCallbackQuery, registerWebhook };
