import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bot } from '../src/bot';
import { env } from '../src/config/env';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === 'GET') {
    res.status(200).send('Telegram webhook is ready.');
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).send('Method not allowed.');
    return;
  }

  if (!env.telegramWebhookSecret) {
    res.status(500).send('Webhook secret is not configured.');
    return;
  }

  const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
  const receivedSecret = Array.isArray(secretHeader) ? secretHeader[0] : secretHeader;
  if (receivedSecret !== env.telegramWebhookSecret) {
    res.status(401).send('Unauthorized.');
    return;
  }

  try {
    await bot.handleUpdate(req.body);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Telegram webhook update failed:', error);
    res.status(500).send('Webhook update failed.');
  }
}
