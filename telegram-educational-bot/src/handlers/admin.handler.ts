import { randomBytes } from 'node:crypto';
import { Markup, type Context } from 'telegraf';
import { env } from '../config/env';
import { supabase } from '../config/supabase';
import { getAdminMenu, getCancelKeyboard } from '../keyboards/menus';
import { BroadcastService } from '../services/broadcast.service';
import { SessionService } from '../services/session.service';
import type { FileType } from '../types/bot';

const fileTypes: FileType[] = ['pdf', 'document', 'audio', 'voice', 'text'];

export class AdminHandler {
  static isAdmin(telegramId?: number): boolean {
    return Boolean(telegramId && env.adminTelegramId === telegramId);
  }

  static async openAdminPanel(ctx: Context): Promise<void> {
    if (!this.isAdmin(ctx.from?.id)) {
      await ctx.reply('هذه اللوحة مخصصة للإدارة فقط.');
      return;
    }

    await SessionService.clearSession(ctx.from!.id);
    await ctx.reply('🛠️ لوحة إدارة البوت:', getAdminMenu());
  }

  static async startPublishWizard(ctx: Context): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!this.isAdmin(telegramId) || !telegramId) return;

    const { data: activeTerm, error: termError } = await supabase
      .from('terms')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();
    if (termError) throw termError;
    if (!activeTerm) {
      await ctx.reply('يجب تفعيل فصل دراسي قبل نشر المحاضرات.', getAdminMenu());
      return;
    }

    const { data: courses, error } = await supabase
      .from('courses')
      .select('id, name')
      .eq('term_id', activeTerm.id)
      .order('name');
    if (error) throw error;
    if (!courses?.length) {
      await ctx.reply('لا توجد مواد في الفصل الدراسي النشط.', getAdminMenu());
      return;
    }

    await SessionService.setSession(telegramId, 'ADMIN_PUB_SELECT_SUBJECT', {});
    await ctx.reply(
      '📤 اختر المادة المراد النشر فيها:',
      Markup.inlineKeyboard(
        courses.map((course) => [Markup.button.callback(course.name, `admin_pub_course:${course.id}`)])
      )
    );
  }

  static async handleCourseSelected(ctx: Context, courseId: string): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!this.isAdmin(telegramId) || !telegramId) return;

    const session = await SessionService.getSession(telegramId);
    if (session.state !== 'ADMIN_PUB_SELECT_SUBJECT') {
      await ctx.answerCbQuery('انتهت صلاحية هذه الخطوة. ابدأ النشر من جديد.');
      return;
    }

    session.payload.course_id = courseId;
    await SessionService.setSession(telegramId, 'ADMIN_PUB_SELECT_TYPE', session.payload);
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      'اختر نوع المحتوى:',
      Markup.inlineKeyboard([
        [Markup.button.callback('📄 PDF', 'pub_type:pdf'), Markup.button.callback('📎 مستند', 'pub_type:document')],
        [Markup.button.callback('🎧 صوت', 'pub_type:audio'), Markup.button.callback('🗣️ Voice', 'pub_type:voice')],
        [Markup.button.callback('📝 نص', 'pub_type:text')],
      ])
    );
  }

  static async handlePublishType(ctx: Context, value: string): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!this.isAdmin(telegramId) || !telegramId) return;
    if (!fileTypes.includes(value as FileType)) {
      await ctx.answerCbQuery('نوع المحتوى غير مدعوم.');
      return;
    }

    const session = await SessionService.getSession(telegramId);
    if (session.state !== 'ADMIN_PUB_SELECT_TYPE') {
      await ctx.answerCbQuery('انتهت صلاحية هذه الخطوة. ابدأ النشر من جديد.');
      return;
    }

    session.payload.file_type = value;
    await ctx.answerCbQuery();
    if (value === 'text') {
      session.payload.lecture_number = 0;
      await SessionService.setSession(telegramId, 'ADMIN_PUB_ENTER_TITLE', session.payload);
      await ctx.reply('أدخل عنوان المحتوى النصي:', getCancelKeyboard());
      return;
    }

    await SessionService.setSession(telegramId, 'ADMIN_PUB_ENTER_NUMBER', session.payload);
    await ctx.reply('أدخل رقم المحاضرة، أو 0 لعدم تحديده:', getCancelKeyboard());
  }

  static async handleWizardStep(ctx: Context, text: string): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!this.isAdmin(telegramId) || !telegramId) return;
    const session = await SessionService.getSession(telegramId);

    switch (session.state) {
      case 'ADMIN_CREATE_COURSE_NAME':
        if (!text.trim()) {
          await ctx.reply('اسم المادة لا يمكن أن يكون فارغاً.');
          return;
        }
        session.payload.name = text.trim();
        await SessionService.setSession(telegramId, 'ADMIN_CREATE_COURSE_DOCTOR', session.payload);
        await ctx.reply('أدخل اسم الدكتور للمادة:');
        return;
      case 'ADMIN_CREATE_COURSE_DOCTOR': {
        const { error } = await supabase.from('courses').insert({
          department_id: session.payload.department_id,
          term_id: session.payload.term_id,
          name: session.payload.name,
          doctor_name: text.trim() || 'غير محدد',
        });
        if (error) throw error;
        await SessionService.clearSession(telegramId);
        await ctx.reply('تمت إضافة المادة.', getAdminMenu());
        return;
      }
      case 'ADMIN_EDIT_COURSE_NAME':
        if (!text.trim()) {
          await ctx.reply('اسم المادة لا يمكن أن يكون فارغاً.');
          return;
        }
        session.payload.name = text.trim();
        await SessionService.setSession(telegramId, 'ADMIN_EDIT_COURSE_DOCTOR', session.payload);
        await ctx.reply('أدخل اسم الدكتور الجديد، أو أرسل - للإبقاء على الاسم الحالي:');
        return;
      case 'ADMIN_EDIT_COURSE_DOCTOR': {
        const updates: { name: string; doctor_name?: string } = { name: session.payload.name };
        if (text.trim() !== '-') updates.doctor_name = text.trim() || 'غير محدد';
        const { error } = await supabase
          .from('courses')
          .update(updates)
          .eq('id', session.payload.course_id);
        if (error) throw error;
        await SessionService.clearSession(telegramId);
        await ctx.reply('تم تحديث المادة.', getAdminMenu());
        return;
      }
      case 'ADMIN_ADD_EVENT_TITLE':
        if (!text.trim()) {
          await ctx.reply('عنوان الموعد لا يمكن أن يكون فارغاً.');
          return;
        }
        session.payload.title = text.trim();
        await SessionService.setSession(telegramId, 'ADMIN_ADD_EVENT_DATE', session.payload);
        await ctx.reply('أرسل الموعد بصيغة ISO مع المنطقة الزمنية، مثل 2026-12-20T10:00:00+03:00:');
        return;
      case 'ADMIN_ADD_EVENT_DATE': {
        const startsAt = new Date(text);
        if (!Number.isFinite(startsAt.getTime()) || !/[zZ]|[+-]\d{2}:?\d{2}$/.test(text)) {
          await ctx.reply('صيغة التاريخ غير صحيحة. أرسل تاريخاً بصيغة ISO مع المنطقة الزمنية.');
          return;
        }
        const { error } = await supabase.from('schedule_events').insert({
          title: session.payload.title,
          starts_at: startsAt.toISOString(),
          created_by: telegramId,
        });
        if (error) throw error;
        await SessionService.clearSession(telegramId);
        const dateLabel = startsAt.toLocaleString('ar-EG', { timeZone: 'UTC' });
        const result = await BroadcastService.sendToAllActiveStudents(async (studentId) => {
          await ctx.telegram.sendMessage(
            studentId,
            `📅 موعد جديد: ${session.payload.title}\n${dateLabel} UTC`
          );
        });
        await ctx.reply(
          `تم حفظ الموعد وإرساله إلى ${result.success} من أصل ${result.total} طالب.`,
          getAdminMenu()
        );
        return;
      }
      case 'ADMIN_PUB_ENTER_NUMBER': {
        const lectureNumber = Number.parseInt(text, 10);
        if (!Number.isInteger(lectureNumber) || lectureNumber < 0) {
          await ctx.reply('أرسل رقماً صحيحاً موجباً أو 0.');
          return;
        }
        session.payload.lecture_number = lectureNumber;
        await SessionService.setSession(telegramId, 'ADMIN_PUB_ENTER_TITLE', session.payload);
        await ctx.reply('أدخل عنوان المحاضرة:', getCancelKeyboard());
        return;
      }
      case 'ADMIN_PUB_ENTER_TITLE':
        session.payload.title = text;
        if (session.payload.file_type === 'text') {
          await SessionService.setSession(telegramId, 'ADMIN_PUB_AWAIT_FILE', session.payload);
          await ctx.reply('أرسل النص الكامل للمحتوى:', getCancelKeyboard());
          return;
        }
        await SessionService.setSession(telegramId, 'ADMIN_PUB_ENTER_DOCTOR', session.payload);
        await ctx.reply('أدخل اسم المحاضر، أو أرسل - للتخطي:', getCancelKeyboard());
        return;
      case 'ADMIN_PUB_ENTER_DOCTOR':
        session.payload.doctor_name = text === '-' ? null : text;
        await SessionService.setSession(telegramId, 'ADMIN_PUB_AWAIT_FILE', session.payload);
        await ctx.reply('أرسل الملف أو الصوت الذي تريد نشره:', getCancelKeyboard());
        return;
      case 'ADMIN_PUB_AWAIT_FILE':
        if (session.payload.file_type === 'text') {
          session.payload.content_text = text;
          await this.showPublishSummary(ctx, session.payload);
          return;
        }
        await ctx.reply('أرسل ملفاً من النوع الذي اخترته، أو ألغِ العملية.');
        return;
      case 'ADMIN_SEND_ANNOUNCEMENT':
        await this.broadcastAnnouncement(ctx, text);
        await SessionService.clearSession(telegramId);
        return;
      default:
        await ctx.reply('لا توجد خطوة إدارية نشطة.');
    }
  }

  static async handleIncomingFile(ctx: Context): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!this.isAdmin(telegramId) || !telegramId) return;
    const session = await SessionService.getSession(telegramId);
    if (session.state !== 'ADMIN_PUB_AWAIT_FILE' || session.payload.file_type === 'text') return;

    const message = ctx.message;
    if (!message) return;
    let fileId: string | undefined;
    let receivedType: FileType | undefined;

    if ('document' in message && message.document) {
      fileId = message.document.file_id;
      receivedType = session.payload.file_type === 'pdf' ? 'pdf' : 'document';
    } else if ('audio' in message && message.audio) {
      fileId = message.audio.file_id;
      receivedType = 'audio';
    } else if ('voice' in message && message.voice) {
      fileId = message.voice.file_id;
      receivedType = 'voice';
    }

    const expectedType = session.payload.file_type as FileType;
    if (!fileId || !receivedType || (expectedType !== 'pdf' && receivedType !== expectedType)) {
      await ctx.reply('الملف لا يطابق النوع المختار. أرسل النوع الصحيح أو ألغِ العملية.');
      return;
    }

    session.payload.telegram_file_id = fileId;
    await this.showPublishSummary(ctx, session.payload);
  }

  static async showPublishSummary(ctx: Context, payload: Record<string, any>): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    await SessionService.setSession(telegramId, 'ADMIN_PUB_CONFIRM', payload);

    const { data: course, error } = await supabase
      .from('courses')
      .select('name, doctor_name')
      .eq('id', payload.course_id)
      .maybeSingle();
    if (error) throw error;

    const summary = [
      'ملخص المحتوى',
      `المادة: ${course?.name ?? 'غير معروفة'}`,
      `الرقم: ${payload.lecture_number || 'غير محدد'}`,
      `العنوان: ${payload.title}`,
      `المحاضر: ${payload.doctor_name ?? course?.doctor_name ?? 'غير محدد'}`,
      `النوع: ${payload.file_type}`,
      '',
      'هل تريد النشر وإشعار الطلاب؟',
    ].join('\n');

    await ctx.reply(
      summary,
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ نشر وإشعار الطلاب', 'admin_pub_confirm_publish')],
        [Markup.button.callback('❌ إلغاء', 'admin_pub_cancel')],
      ])
    );
  }

  static async executePublish(ctx: Context): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!this.isAdmin(telegramId) || !telegramId) return;
    const session = await SessionService.getSession(telegramId);
    if (session.state !== 'ADMIN_PUB_CONFIRM') {
      await ctx.answerCbQuery('لا يوجد محتوى جاهز للنشر.');
      return;
    }

    const payload = session.payload;
    const { data: lecture, error } = await supabase
      .from('lectures')
      .insert({
        course_id: payload.course_id,
        lecture_number: payload.lecture_number || null,
        title: payload.title,
        doctor_name: payload.doctor_name || null,
        telegram_file_id: payload.telegram_file_id || null,
        file_type: payload.file_type,
        content_text: payload.content_text || null,
      })
      .select('id, title, lecture_number, doctor_name, file_type, content_text, telegram_file_id, course_id')
      .single();
    if (error) throw error;

    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('name')
      .eq('id', payload.course_id)
      .single();
    if (courseError) throw courseError;

    await ctx.answerCbQuery();
    await ctx.reply('تم حفظ المحتوى. جارٍ إرسال الإشعار...');
    const result = await BroadcastService.sendToAllActiveStudents(async (studentId) => {
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📄 فتح المحاضرة', `get_lecture:${lecture.id}`)],
      ]);
      await ctx.telegram.sendMessage(
        studentId,
        `📚 محتوى جديد\nالمادة: ${course.name}\nالعنوان: ${lecture.title}`,
        keyboard
      );
    });

    await SessionService.clearSession(telegramId);
    await ctx.reply(
      `اكتمل النشر.\nالإجمالي: ${result.total}\nتم الإرسال: ${result.success}\nتعذّر الإرسال: ${result.failed}`,
      getAdminMenu()
    );
  }

  static async broadcastAnnouncement(ctx: Context, text: string): Promise<void> {
    const { error } = await supabase.from('announcements').insert({ title: 'إعلان مهم', content: text });
    if (error) throw error;

    const result = await BroadcastService.sendToAllActiveStudents(async (studentId) => {
      await ctx.telegram.sendMessage(studentId, `📢 إعلان مهم\n\n${text}`);
    });

    await ctx.reply(
      `اكتمل إرسال الإعلان. وصل إلى ${result.success} من أصل ${result.total} طالب.`,
      getAdminMenu()
    );
  }

  static async startActivationCodeMenu(ctx: Context): Promise<void> {
    if (!this.isAdmin(ctx.from?.id)) return;
    const { data: departments, error } = await supabase
      .from('departments')
      .select('id, name')
      .order('name');
    if (error) throw error;
    if (!departments?.length) {
      await ctx.reply('أضف قسماً قبل إنشاء رموز التفعيل.', getAdminMenu());
      return;
    }

    await ctx.reply(
      'اختر القسم الذي سيُربط برمز التفعيل:',
      Markup.inlineKeyboard(
        departments.map((department) => [
          Markup.button.callback(department.name, `admin_code_department:${department.id}`),
        ])
      )
    );
  }

  static async createActivationCode(ctx: Context, departmentId: string): Promise<void> {
    if (!this.isAdmin(ctx.from?.id)) return;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const code = `STU-${randomBytes(4).toString('hex').toUpperCase()}`;
      const { error } = await supabase.from('activation_codes').insert({
        code,
        department_id: departmentId,
      });
      if (!error) {
        await ctx.answerCbQuery('تم إنشاء الرمز.');
        await ctx.reply(`رمز التفعيل الجديد:\n${code}`, getAdminMenu());
        return;
      }
      if (error.code !== '23505') throw error;
    }
    throw new Error('Could not generate a unique activation code.');
  }

  static async startCourseManagement(ctx: Context): Promise<void> {
    if (!this.isAdmin(ctx.from?.id)) return;
    const { data: courses, error } = await supabase
      .from('courses')
      .select('id, name')
      .order('name')
      .limit(30);
    if (error) throw error;

    const rows = (courses ?? []).map((course) => [
      Markup.button.callback(`✏️ ${course.name}`, `admin_course_edit:${course.id}`),
      Markup.button.callback('🗑️ حذف', `admin_course_delete:${course.id}`),
    ]);
    rows.push([Markup.button.callback('➕ إضافة مادة', 'admin_course_add')]);
    await ctx.reply('إدارة المواد:', Markup.inlineKeyboard(rows));
  }

  static async startCourseCreation(ctx: Context): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!this.isAdmin(telegramId) || !telegramId) return;
    const [termResult, departmentResult] = await Promise.all([
      supabase.from('terms').select('id').eq('is_active', true).maybeSingle(),
      supabase.from('departments').select('id, name').order('name'),
    ]);
    if (termResult.error) throw termResult.error;
    if (departmentResult.error) throw departmentResult.error;
    if (!termResult.data) {
      await ctx.answerCbQuery('لا يوجد فصل دراسي نشط.');
      await ctx.reply('فعّل فصلاً دراسياً أولاً.', getAdminMenu());
      return;
    }
    if (!departmentResult.data?.length) {
      await ctx.answerCbQuery('لا توجد أقسام.');
      await ctx.reply('أضف قسماً أولاً.', getAdminMenu());
      return;
    }

    await ctx.answerCbQuery();
    await SessionService.setSession(telegramId, 'ADMIN_SELECT_COURSE_DEPARTMENT', {
      term_id: termResult.data.id,
    });
    await ctx.reply(
      'اختر قسم المادة الجديدة:',
      Markup.inlineKeyboard(
        departmentResult.data.map((department) => [
          Markup.button.callback(department.name, `admin_course_department:${department.id}`),
        ])
      )
    );
  }

  static async handleCourseDepartment(ctx: Context, departmentId: string): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!this.isAdmin(telegramId) || !telegramId) return;
    const session = await SessionService.getSession(telegramId);
    if (session.state !== 'ADMIN_SELECT_COURSE_DEPARTMENT') {
      await ctx.answerCbQuery('انتهت صلاحية هذه الخطوة.');
      return;
    }
    session.payload.department_id = departmentId;
    await SessionService.setSession(telegramId, 'ADMIN_CREATE_COURSE_NAME', session.payload);
    await ctx.answerCbQuery();
    await ctx.reply('أدخل اسم المادة الجديدة:', getCancelKeyboard());
  }

  static async startCourseEdit(ctx: Context, courseId: string): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!this.isAdmin(telegramId) || !telegramId) return;
    const { data: course, error } = await supabase
      .from('courses')
      .select('id, name')
      .eq('id', courseId)
      .maybeSingle();
    if (error) throw error;
    if (!course) {
      await ctx.answerCbQuery('المادة غير موجودة.');
      return;
    }
    await SessionService.setSession(telegramId, 'ADMIN_EDIT_COURSE_NAME', { course_id: courseId });
    await ctx.answerCbQuery();
    await ctx.reply(`أرسل الاسم الجديد للمادة الحالية «${course.name}»:`, getCancelKeyboard());
  }

  static async confirmCourseDelete(ctx: Context, courseId: string): Promise<void> {
    if (!this.isAdmin(ctx.from?.id)) return;
    const { data: course, error } = await supabase
      .from('courses')
      .select('name')
      .eq('id', courseId)
      .maybeSingle();
    if (error) throw error;
    if (!course) {
      await ctx.answerCbQuery('المادة غير موجودة.');
      return;
    }
    await ctx.answerCbQuery();
    await ctx.reply(
      `حذف «${course.name}» سيحذف محاضراتها أيضاً. هل تريد المتابعة؟`,
      Markup.inlineKeyboard([
        [Markup.button.callback('تأكيد الحذف', `admin_course_delete_confirm:${courseId}`)],
        [Markup.button.callback('إلغاء', 'admin_course_delete_cancel')],
      ])
    );
  }

  static async deleteCourse(ctx: Context, courseId: string): Promise<void> {
    if (!this.isAdmin(ctx.from?.id)) return;
    const { data, error } = await supabase
      .from('courses')
      .delete()
      .eq('id', courseId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    await ctx.answerCbQuery(data ? 'تم حذف المادة ومحاضراتها.' : 'المادة غير موجودة.');
    await ctx.reply(data ? 'تم الحذف.' : 'لم يتم العثور على المادة.', getAdminMenu());
  }

  static async startStudentManagement(ctx: Context): Promise<void> {
    if (!this.isAdmin(ctx.from?.id)) return;
    const { data: students, error } = await supabase
      .from('students')
      .select('telegram_id, full_name, is_active')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    if (!students?.length) {
      await ctx.reply('لا يوجد طلاب مسجلون بعد.', getAdminMenu());
      return;
    }

    await ctx.reply(
      'اختر طالباً لتبديل حالة حسابه:',
      Markup.inlineKeyboard(
        students.map((student) => [
          Markup.button.callback(
            `${student.is_active ? '✅' : '⛔'} ${student.full_name} (${student.telegram_id})`,
            `admin_student_toggle:${student.telegram_id}`
          ),
        ])
      )
    );
  }

  static async toggleStudent(ctx: Context, telegramIdText: string): Promise<void> {
    if (!this.isAdmin(ctx.from?.id)) return;
    const telegramId = Number(telegramIdText);
    if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
      await ctx.answerCbQuery('معرّف الطالب غير صالح.');
      return;
    }
    const { data: student, error: readError } = await supabase
      .from('students')
      .select('is_active')
      .eq('telegram_id', telegramId)
      .maybeSingle();
    if (readError) throw readError;
    if (!student) {
      await ctx.answerCbQuery('الطالب غير موجود.');
      return;
    }
    const { error } = await supabase
      .from('students')
      .update({ is_active: !student.is_active })
      .eq('telegram_id', telegramId);
    if (error) throw error;
    await ctx.answerCbQuery(student.is_active ? 'تم تعطيل الحساب.' : 'تم تفعيل الحساب.');
    await this.startStudentManagement(ctx);
  }

  static async startScheduleEvent(ctx: Context): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!this.isAdmin(telegramId) || !telegramId) return;
    await SessionService.setSession(telegramId, 'ADMIN_ADD_EVENT_TITLE');
    await ctx.reply('أدخل عنوان الموعد أو الامتحان:', getCancelKeyboard());
  }

  static async showStats(ctx: Context): Promise<void> {
    if (!this.isAdmin(ctx.from?.id)) return;

    const [students, courses, lectures] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }),
      supabase.from('courses').select('*', { count: 'exact', head: true }),
      supabase.from('lectures').select('*', { count: 'exact', head: true }),
    ]);
    const error = students.error ?? courses.error ?? lectures.error;
    if (error) throw error;

    await ctx.reply(
      `إحصائيات البوت\n\nالطلاب: ${students.count ?? 0}\nالمواد: ${courses.count ?? 0}\nالمحاضرات: ${lectures.count ?? 0}`,
      getAdminMenu()
    );
  }
}
