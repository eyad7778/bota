import { supabase } from '../config/supabase';

export interface BroadcastResult {
  total: number;
  success: number;
  failed: number;
}

export class BroadcastService {
  static async sendToAllActiveStudents(
    messageBuilder: (studentTelegramId: number) => Promise<void> | void
  ): Promise<BroadcastResult> {
    const { data: students, error } = await supabase
      .from('students')
      .select('telegram_id')
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    if (!students?.length) {
      return { total: 0, success: 0, failed: 0 };
    }

    let success = 0;
    let failed = 0;
    const batchSize = 25;
    const delayMs = 1000;

    for (let index = 0; index < students.length; index += batchSize) {
      const batch = students.slice(index, index + batchSize);

      await Promise.allSettled(
        batch.map(async (student) => {
          try {
            await messageBuilder(Number(student.telegram_id));
            success += 1;
          } catch (error) {
            failed += 1;
            const telegramError = error as { response?: { error_code?: number } };
            if (telegramError.response?.error_code === 403) {
              await supabase
                .from('students')
                .update({ is_active: false })
                .eq('telegram_id', student.telegram_id);
            }
          }
        })
      );

      if (index + batchSize < students.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return { total: students.length, success, failed };
  }
}
