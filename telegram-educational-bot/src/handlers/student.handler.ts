import { Markup, type Context } from 'telegraf';
import { supabase } from '../config/supabase';
import { getMainMenu } from '../keyboards/menus';
import { checkStudentStatus } from '../services/auth';
import { searchLectures } from '../services/search';

export class StudentHandler {
  static async handleLecturesMenu(ctx: Context): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const status = await checkStudentStatus(telegramId);
    if (!status.active || !status.student?.department_id) {
      await ctx.reply('حسابك غير مفعّل بعد. أرسل رمز التفعيل أولاً.');
      return;
    }

    const { data: activeTerm, error: termError } = await supabase
      .from('terms')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();
    if (termError) throw termError;
    if (!activeTerm) {
      await ctx.reply('لا توجد فصول دراسية نشطة حالياً.', getMainMenu());
      return;
    }

    const { data: courses, error } = await supabase
      .from('courses')
      .select('id, name')
      .eq('department_id', status.student.department_id)
      .eq('term_id', activeTerm.id)
      .order('name');
    if (error) throw error;

    if (!courses?.length) {
      await ctx.reply('لا توجد مواد دراسية مضافة حالياً.', getMainMenu());
      return;
    }

    await ctx.reply(
      '📚 اختر المادة الدراسية لعرض محاضراتها:',
      Markup.inlineKeyboard(
        courses.map((course) => [Markup.button.callback(`📖 ${course.name}`, `select_course:${course.id}`)])
      )
    );
  }

  static async handleSelectCourse(ctx: Context, courseId: string): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const status = await checkStudentStatus(telegramId);
    if (!status.active || !status.student?.department_id) {
      await ctx.answerCbQuery('حسابك غير مفعّل.');
      return;
    }

    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .eq('department_id', status.student.department_id)
      .maybeSingle();
    if (courseError) throw courseError;
    if (!course) {
      await ctx.answerCbQuery('المادة غير متاحة لحسابك.');
      return;
    }

    const { data: lectures, error } = await supabase
      .from('lectures')
      .select('id, title, lecture_number')
      .eq('course_id', courseId)
      .order('lecture_number', { ascending: true });
    if (error) throw error;

    if (!lectures?.length) {
      await ctx.answerCbQuery('لا توجد محاضرات لهذه المادة حتى الآن.');
      return;
    }

    await ctx.answerCbQuery();
    await ctx.editMessageText(
      '📄 اختر المحاضرة المطلوبة:',
      Markup.inlineKeyboard(
        lectures.map((lecture) => [
          Markup.button.callback(
            `المحاضرة ${lecture.lecture_number}: ${lecture.title}`,
            `get_lecture:${lecture.id}`
          ),
        ])
      )
    );
  }

  static async handleGetLecture(ctx: Context, lectureId: string): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const status = await checkStudentStatus(telegramId);
    if (!status.active || !status.student?.department_id) {
      await ctx.answerCbQuery('حسابك غير مفعّل.');
      return;
    }

    const { data: lecture, error } = await supabase
      .from('lectures')
      .select('*')
      .eq('id', lectureId)
      .maybeSingle();
    if (error) throw error;
    if (!lecture) {
      await ctx.answerCbQuery('المحاضرة غير موجودة.');
      return;
    }

    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('department_id')
      .eq('id', lecture.course_id)
      .maybeSingle();
    if (courseError) throw courseError;
    if (course?.department_id !== status.student.department_id) {
      await ctx.answerCbQuery('المحاضرة غير متاحة لحسابك.');
      return;
    }

    await ctx.answerCbQuery();
    const caption = `📚 ${lecture.title}${lecture.lecture_number ? `\n🔢 رقم المحاضرة: ${lecture.lecture_number}` : ''}${lecture.doctor_name ? `\n👨‍🏫 المحاضر: ${lecture.doctor_name}` : ''}`;

    if (lecture.file_type === 'text') {
      await ctx.reply(`${caption}\n\n📝 المحتوى:\n${lecture.content_text ?? ''}`);
      return;
    }

    const fileId = lecture.telegram_file_id;
    if (!fileId) {
      await ctx.reply('ملف هذه المحاضرة غير متاح حالياً.');
      return;
    }

    if (lecture.file_type === 'audio') {
      await ctx.replyWithAudio(fileId, { caption });
    } else if (lecture.file_type === 'voice') {
      await ctx.replyWithVoice(fileId, { caption });
    } else {
      await ctx.replyWithDocument(fileId, { caption });
    }
  }

  static async handleSearchQuery(ctx: Context, queryText: string): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const status = await checkStudentStatus(telegramId);
    if (!status.active || !status.student?.department_id) {
      await ctx.reply('حسابك غير مفعّل بعد.');
      return;
    }

    const matches = await searchLectures(queryText, status.student.department_id);
    if (!matches.length) {
      await ctx.reply('لم يتم العثور على نتائج مطابقة.', getMainMenu());
      return;
    }

    await ctx.reply(
      `🔍 نتائج البحث عن: "${queryText}":`,
      Markup.inlineKeyboard(
        matches.slice(0, 10).map((lecture) => [
          Markup.button.callback(`[${lecture.course_name}] ${lecture.title}`, `get_lecture:${lecture.id}`),
        ])
      )
    );
  }

  static async handleMyAccount(ctx: Context): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const status = await checkStudentStatus(telegramId);
    if (!status.student) {
      await ctx.reply('حسابك غير مفعل بعد.');
      return;
    }

    const student = status.student;
    await ctx.reply(
      `👤 معلومات حسابي\n\n🆔 المعرّف: ${student.telegram_id}\n⚡ الحالة: ${student.is_active ? 'مفعّل' : 'معطّل'}\n📅 تاريخ التفعيل: ${new Date(student.created_at).toLocaleDateString('ar-EG')}`,
      getMainMenu()
    );
  }
}
