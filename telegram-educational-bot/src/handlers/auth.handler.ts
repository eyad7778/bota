import type { Context } from 'telegraf';
import { activateAccount } from '../services/auth';
import { SessionService } from '../services/session.service';
import { getMainMenu } from '../keyboards/menus';

export class AuthHandler {
  static async handleActivation(ctx: Context, code: string): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const name = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ') || 'طالب';
    const result = await activateAccount(telegramId, name, code);

    if (result.status === 'activated' || result.status === 'already_active') {
      await SessionService.clearSession(telegramId);
      await ctx.reply(result.message, getMainMenu());
      return;
    }

    await ctx.reply(result.message);
  }
}
