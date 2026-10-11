import crypto from 'crypto';
import { env } from '../config/env';

export function verifyTelegramWebAppData(telegramInitData: string, maxAgeSeconds = 86400): boolean {
  if (!telegramInitData) return false;

  const params = new URLSearchParams(telegramInitData);
  const hash = params.get('hash');
  const authDate = Number(params.get('auth_date'));
  const now = Math.floor(Date.now() / 1000);
  if (
    !hash || !/^[a-f\d]{64}$/i.test(hash) ||
    !Number.isSafeInteger(authDate) || authDate <= 0 ||
    now - authDate > maxAgeSeconds || authDate > now + 30
  ) {
    return false;
  }

  params.delete('hash');
  const dataCheckString = Array.from(params.entries())
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(env.botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest();
  const receivedHash = Buffer.from(hash, 'hex');

  return receivedHash.length === calculatedHash.length && crypto.timingSafeEqual(receivedHash, calculatedHash);
}