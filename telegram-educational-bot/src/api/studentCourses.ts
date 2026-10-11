import type { Request, Response } from 'express';
import { getMiniAppCourses } from './miniApp';

export async function handleStudentCoursesRequest(req: Request, res: Response): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const result = await getMiniAppCourses(req.body?.initData);
  res.status(result.status).json(result.body);
}