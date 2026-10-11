import express from 'express';
import path from 'node:path';
import { handleStudentCoursesRequest } from './api/studentCourses';
import { handleOpenLectureRequest, handleStudentLecturesRequest } from './api/studentLectures';
import { bot } from './bot';
import { env } from './config/env';

const app = express();
const port = env.port;

app.use(express.json({ limit: '32kb' }));
app.get(['/app', '/app/'], (_req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'public', 'app.html'));
});
app.post('/api/student-courses', (req, res) => {
  void handleStudentCoursesRequest(req, res);
});
app.post('/api/student-lectures', (req, res) => {
  void handleStudentLecturesRequest(req, res);
});
app.post('/api/open-lecture', (req, res) => {
  void handleOpenLectureRequest(req, res, bot.telegram);
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'telegram-educational-bot',
    timestamp: new Date().toISOString(),
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);

  bot
    .launch({ dropPendingUpdates: true })
    .then(() => {
      console.log('Telegram bot launched successfully.');
    })
    .catch((error) => {
      console.error('Failed to launch Telegram bot:', error);
      process.exit(1);
    });
});

process.once('SIGINT', () => {
  void bot.stop('SIGINT');
  process.exit(0);
});

process.once('SIGTERM', () => {
  void bot.stop('SIGTERM');
  process.exit(0);
});

export default app;
