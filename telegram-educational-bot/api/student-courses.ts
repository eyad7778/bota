import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getMiniAppCourses } from '../src/api/miniApp';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const result = await getMiniAppCourses(req.body?.initData);
  res.status(result.status).json(result.body);
}