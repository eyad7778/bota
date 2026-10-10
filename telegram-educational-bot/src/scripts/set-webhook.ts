import { bot } from '../bot';
import { env } from '../config/env';

async function setWebhook(): Promise<void> {
  if (process.argv.includes('--delete')) {
    await bot.telegram.deleteWebhook({ drop_pending_updates: false });
    console.log('Telegram webhook removed.');
    return;
  }

  if (!env.appBaseUrl) {
    throw new Error('Set APP_BASE_URL to the deployed HTTPS origin before registering the webhook.');
  }
  if (!env.appBaseUrl.startsWith('https://')) {
    throw new Error('APP_BASE_URL must use HTTPS.');
  }
  if (!env.telegramWebhookSecret) {
    throw new Error('Set TELEGRAM_WEBHOOK_SECRET before registering the webhook.');
  }

  const webhookUrl = `${env.appBaseUrl}/api`;
  await bot.telegram.setWebhook(webhookUrl, {
    secret_token: env.telegramWebhookSecret,
    allowed_updates: ['message', 'callback_query'],
  });
  console.log(`Telegram webhook registered at ${webhookUrl}`);
}

void setWebhook().catch((error) => {
  console.error('Failed to register Telegram webhook:', error);
  process.exitCode = 1;
});
