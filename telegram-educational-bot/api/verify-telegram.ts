import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyTelegramWebAppData } from '../src/api/verifyTelegram';
import { checkStudentStatus } from '../src/services/auth';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const initData = typeof req.body?.initData === 'string' ? req.body.initData : '';
  if (!verifyTelegramWebAppData(initData)) {
    res.status(401).json({ error: 'Invalid or expired Telegram session.' });
    return;
  }

  try {
    const userData = new URLSearchParams(initData).get('user');
    const user: unknown = userData ? JSON.parse(userData) : null;
    if (!user || typeof user !== 'object' || !('id' in user) || !Number.isSafeInteger(user.id)) {
      res.status(401).json({ error: 'Invalid Telegram user data.' });
      return;
    }

    const telegramId = user.id as number;
    const status = await checkStudentStatus(telegramId);
    if (!status.active) {
      res.status(403).json({ error: 'Student account is not active.' });
      return;
    }

    res.status(200).json({ valid: true, telegramId });
  } catch (error) {
    console.error('Telegram Mini App verification failed:', error);
    res.status(400).json({ error: 'Invalid Telegram user data.' });
  }
}