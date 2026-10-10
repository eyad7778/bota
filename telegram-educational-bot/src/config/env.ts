import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const adminTelegramIdValue = process.env.ADMIN_TELEGRAM_ID?.trim();
const adminTelegramId = adminTelegramIdValue ? Number(adminTelegramIdValue) : undefined;
const telegramWebhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

if (adminTelegramIdValue && (!Number.isSafeInteger(adminTelegramId) || adminTelegramId! <= 0)) {
  throw new Error('ADMIN_TELEGRAM_ID must be a positive Telegram user ID.');
}
if (telegramWebhookSecret && !/^[A-Za-z0-9_-]{1,256}$/.test(telegramWebhookSecret)) {
  throw new Error('TELEGRAM_WEBHOOK_SECRET may contain only letters, numbers, underscores, and hyphens.');
}

export const env = {
  botToken: required('BOT_TOKEN'),
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  adminTelegramId,
  appBaseUrl: process.env.APP_BASE_URL?.trim().replace(/\/+$/, ''),
  telegramWebhookSecret,
  port: Number(process.env.PORT ?? 3000),
};
