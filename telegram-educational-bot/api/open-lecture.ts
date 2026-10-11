import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Telegraf } from 'telegraf';
import { getMiniAppLectureForDelivery } from '../src/api/miniApp';
import { env } from '../src/config/env';

const bot = new Telegraf(env.botToken);

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const result = await getMiniAppLectureForDelivery(req.body?.initData, req.body?.lectureId);
  if ('status' in result) {
    res.status(result.status).json(result.body);
    return;
  }

  const { lecture, telegramId } = result;
  const caption = `📚 ${lecture.title}${lecture.lecture_number ? `\n🔢 رقم المحاضرة: ${lecture.lecture_number}` : ''}`;
  try {
    if (lecture.file_type === 'text') {
      await bot.telegram.sendMessage(telegramId, `${caption}\n\n${lecture.content_text ?? ''}`);
    } else if (lecture.telegram_file_id && lecture.file_type === 'audio') {
      await bot.telegram.sendAudio(telegramId, lecture.telegram_file_id, { caption });
    } else if (lecture.telegram_file_id && lecture.file_type === 'voice') {
      await bot.telegram.sendVoice(telegramId, lecture.telegram_file_id, { caption });
    } else if (lecture.telegram_file_id) {
      await bot.telegram.sendDocument(telegramId, lecture.telegram_file_id, { caption });
    } else {
      res.status(404).json({ error: 'Lecture content is unavailable.' });
      return;
    }

    res.status(200).json({ message: 'أرسلت المحاضرة إلى محادثتك مع ماجد.' });
  } catch (error) {
    console.error('Mini App lecture delivery failed:', error);
    res.status(502).json({ error: 'تعذّر إرسال المحاضرة. حاول مرة أخرى.' });
  }
}