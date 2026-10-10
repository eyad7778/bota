import { supabase } from '../config/supabase';
import type { BotSession, SessionState } from '../types/bot';

export class SessionService {
  static async getSession(telegramId: number): Promise<BotSession> {
    const { data, error } = await supabase
      .from('bot_sessions')
      .select('*')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return { telegram_id: telegramId, state: 'IDLE', payload: {} };
    }

    return data as BotSession;
  }

  static async setSession(
    telegramId: number,
    state: SessionState,
    payload: Record<string, any> = {}
  ): Promise<void> {
    const { error } = await supabase.from('bot_sessions').upsert({
      telegram_id: telegramId,
      state,
      payload,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      throw error;
    }
  }

  static async clearSession(telegramId: number): Promise<void> {
    await this.setSession(telegramId, 'IDLE', {});
  }
}
