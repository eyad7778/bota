import type { Context } from 'telegraf';
import { supabase } from '../config/supabase';

type NotificationTarget = { student_id: number };
export type NotificationResult = { total: number; sent: number; failed: number };

export async function broadcastNotification(
  telegram: Context['telegram'],
  courseId: string,
  message: string,
  contentType: string
): Promise<NotificationResult> {
  const { data: targetStudents, error } = await supabase
    .from('student_notification_settings')
    .select('student_id, students!inner(is_active)')
    .eq('course_id', courseId)
    .eq('notify_lectures', true)
    .eq('students.is_active', true);
  if (error) throw error;
  if (!targetStudents?.length) return { total: 0, sent: 0, failed: 0 };

  const chunkSize = 20;
  const recipients = targetStudents as NotificationTarget[];
  const result: NotificationResult = { total: recipients.length, sent: 0, failed: 0 };
  for (let index = 0; index < recipients.length; index += chunkSize) {
    const chunk = recipients.slice(index, index + chunkSize);

    await Promise.all(
      chunk.map(async ({ student_id: studentId }) => {
        let status: 'sent' | 'failed' = 'sent';
        let errorMessage: string | null = null;
        try {
          await telegram.sendMessage(studentId, message);
        } catch (sendError) {
          status = 'failed';
          errorMessage = sendError instanceof Error ? sendError.message : 'Unknown error';
        }
        result[status] += 1;

        const { error: logError } = await supabase.from('notification_logs').insert({
          student_id: studentId,
          course_id: courseId,
          content_type: contentType,
          status,
          error_message: errorMessage,
        });
        if (logError) console.error('Failed to write notification log:', logError);
      })
    );

    if (index + chunkSize < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return result;
}