import type { Request, Response } from 'express';
import type { Context } from 'telegraf';
import { getMiniAppLectureForDelivery, getMiniAppLectures } from './miniApp';

export async function handleStudentLecturesRequest(req: Request, res: Response): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const result = await getMiniAppLectures(req.body?.initData, req.body?.courseId);
  res.status(result.status).json(result.body);
}

export async function handleOpenLectureRequest(
  req: Request,
  res: Response,
  telegram: Context['telegram']
): Promise<void> {
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
      await telegram.sendMessage(telegramId, `${caption}\n\n${lecture.content_text ?? ''}`);
    } else if (lecture.telegram_file_id && lecture.file_type === 'audio') {
      await telegram.sendAudio(telegramId, lecture.telegram_file_id, { caption });
    } else if (lecture.telegram_file_id && lecture.file_type === 'voice') {
      await telegram.sendVoice(telegramId, lecture.telegram_file_id, { caption });
    } else if (lecture.telegram_file_id) {
      await telegram.sendDocument(telegramId, lecture.telegram_file_id, { caption });
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