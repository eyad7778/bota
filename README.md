# bota

## Telegram educational bot

The bot application is in `telegram-educational-bot/`. Configure its `.env` file with `BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `ADMIN_TELEGRAM_ID` (your numeric Telegram user ID). `PORT` is optional and defaults to `3000`.

Before starting the bot, run `telegram-educational-bot/schema.sql` in the SQL editor of the matching Supabase project. The script creates the session and announcement tables and extends lectures to store text, audio, documents, and optional lecture numbers.

```powershell
cd telegram-educational-bot
npm install
npm run dev
```

The local server uses Telegram long polling. Persisted sessions survive process restarts.

## Vercel webhook

Set the Vercel project root to `telegram-educational-bot/`. Add `BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, numeric `ADMIN_TELEGRAM_ID` (not an `@username`), and `TELEGRAM_WEBHOOK_SECRET` as Vercel environment variables. After deployment, put `APP_BASE_URL` (the deployed HTTPS origin) and the same webhook secret in the local `.env`, then run `npm run set-webhook` from the project directory. The webhook route is `/api` and checks Telegram's secret-token header.

To return to local polling, run `npm run delete-webhook` before `npm run dev`. Do not run polling while the Telegram webhook is registered.

The admin menu supports activation-code creation, course create/edit/delete, student activation toggles, schedule announcements, lecture publishing, broadcasts, and counts. Deleting a course also deletes its lectures.

Run `npm run typecheck:vercel` to check the serverless route in addition to the normal `npm run typecheck` and `npm run build` checks.