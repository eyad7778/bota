import express from 'express';
import { bot } from './bot';
import { env } from './config/env';

const app = express();
const port = env.port;

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
