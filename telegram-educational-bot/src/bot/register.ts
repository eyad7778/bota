import { Telegraf, type Context } from 'telegraf';
import { env } from '../config/env';
import { AdminHandler } from '../handlers/admin.handler';
import { AuthHandler } from '../handlers/auth.handler';
import { StudentHandler } from '../handlers/student.handler';
import { getCancelKeyboard, getMainMenu } from '../keyboards/menus';
import { checkStudentStatus } from '../services/auth';
import { SessionService } from '../services/session.service';

export const bot = new Telegraf<Context>(env.botToken);

const activationCodePattern = /^[A-Z0-9-]{6,12}$/i;

bot.start(async (ctx) => {
  const telegramId = ctx.from.id;
  const status = await checkStudentStatus(telegramId);

  if (status.active) {
    await SessionService.clearSession(telegramId);
    await ctx.reply(`أهلاً بك مجدداً يا ${ctx.from.first_name}!`, getMainMenu());
    return;
  }

  await SessionService.setSession(telegramId, 'AWAITING_CODE');
  await ctx.reply('مرحباً بك! أرسل رمز التفعيل الخاص بك لتفعيل الحساب.');
});

bot.command('admin', (ctx) => AdminHandler.openAdminPanel(ctx));
bot.hears('🛠️ لوحة الإدارة', (ctx) => AdminHandler.openAdminPanel(ctx));
bot.hears('📤 نشر محاضرة أو محتوى', (ctx) => AdminHandler.startPublishWizard(ctx));
bot.hears('📚 إدارة المواد', (ctx) => AdminHandler.startCourseManagement(ctx));
bot.hears('🎟️ أرقام التفعيل', (ctx) => AdminHandler.startActivationCodeMenu(ctx));
bot.hears('👥 إدارة الطلاب', (ctx) => AdminHandler.startStudentManagement(ctx));
bot.hears('📅 إضافة موعد', (ctx) => AdminHandler.startScheduleEvent(ctx));
bot.hears('📢 إرسال إعلان', async (ctx) => {
  if (!AdminHandler.isAdmin(ctx.from?.id) || !ctx.from) return;
  await SessionService.setSession(ctx.from.id, 'ADMIN_SEND_ANNOUNCEMENT');
  await ctx.reply('اكتب نص الإعلان الذي تريد إرساله للطلاب:', getCancelKeyboard());
});
bot.hears('📊 عرض الإحصائيات', (ctx) => AdminHandler.showStats(ctx));
bot.hears('📚 المحاضرات', (ctx) => StudentHandler.handleLecturesMenu(ctx));
bot.hears('🔍 البحث عن محاضرة', async (ctx) => {
  if (!ctx.from) return;
  const status = await checkStudentStatus(ctx.from.id);
  if (!status.active) {
    await ctx.reply('حسابك غير مفعّل بعد. أرسل رمز التفعيل أولاً.');
    return;
  }
  await SessionService.setSession(ctx.from.id, 'SEARCH_AWAIT_QUERY');
  await ctx.reply('اكتب اسم المادة أو عنوان المحاضرة أو اسم المحاضر:');
});
bot.hears('👤 حسابي', (ctx) => StudentHandler.handleMyAccount(ctx));
bot.hears('🏠 القائمة الرئيسية', async (ctx) => {
  if (ctx.from) await SessionService.clearSession(ctx.from.id);
  await ctx.reply('القائمة الرئيسية:', getMainMenu());
});

bot.action(/^select_course:([\w-]+)$/, (ctx) =>
  StudentHandler.handleSelectCourse(ctx, ctx.match[1])
);
bot.action(/^get_lecture:([\w-]+)$/, (ctx) =>
  StudentHandler.handleGetLecture(ctx, ctx.match[1])
);
bot.action(/^admin_pub_course:([\w-]+)$/, (ctx) =>
  AdminHandler.handleCourseSelected(ctx, ctx.match[1])
);
bot.action(/^admin_code_department:([\w-]+)$/, (ctx) =>
  AdminHandler.createActivationCode(ctx, ctx.match[1])
);
bot.action(/^admin_course_department:([\w-]+)$/, (ctx) =>
  AdminHandler.handleCourseDepartment(ctx, ctx.match[1])
);
bot.action('admin_course_add', (ctx) => AdminHandler.startCourseCreation(ctx));
bot.action(/^admin_course_edit:([\w-]+)$/, (ctx) =>
  AdminHandler.startCourseEdit(ctx, ctx.match[1])
);
bot.action(/^admin_course_delete:([\w-]+)$/, (ctx) =>
  AdminHandler.confirmCourseDelete(ctx, ctx.match[1])
);
bot.action(/^admin_course_delete_confirm:([\w-]+)$/, (ctx) =>
  AdminHandler.deleteCourse(ctx, ctx.match[1])
);
bot.action('admin_course_delete_cancel', async (ctx) => {
  await ctx.answerCbQuery('تم إلغاء الحذف.');
});
bot.action(/^admin_student_toggle:(\d+)$/, (ctx) =>
  AdminHandler.toggleStudent(ctx, ctx.match[1])
);
bot.action(/^pub_type:(pdf|document|audio|voice|text)$/, (ctx) =>
  AdminHandler.handlePublishType(ctx, ctx.match[1])
);
bot.action('admin_pub_confirm_publish', (ctx) => AdminHandler.executePublish(ctx));
bot.action('admin_pub_cancel', async (ctx) => {
  if (!ctx.from) return;
  await SessionService.clearSession(ctx.from.id);
  await ctx.answerCbQuery('تم الإلغاء.');
  await ctx.reply('تم إلغاء النشر.', getMainMenu());
});

bot.on(['document', 'audio', 'voice'], (ctx) => AdminHandler.handleIncomingFile(ctx));

bot.on('text', async (ctx) => {
  const telegramId = ctx.from.id;
  const text = ctx.message.text.trim();

  if (text === '❌ إلغاء العملية') {
    await SessionService.clearSession(telegramId);
    await ctx.reply('تم إلغاء العملية.', getMainMenu());
    return;
  }

  const session = await SessionService.getSession(telegramId);
  if (AdminHandler.isAdmin(telegramId) && session.state.startsWith('ADMIN_')) {
    await AdminHandler.handleWizardStep(ctx, text);
    return;
  }

  const status = await checkStudentStatus(telegramId);
  if (!status.active) {
    if (!activationCodePattern.test(text)) {
      await SessionService.setSession(telegramId, 'AWAITING_CODE');
      await ctx.reply('أرسل رمز التفعيل المكوّن من 6 إلى 12 حرفاً أو رقماً.');
      return;
    }
    await AuthHandler.handleActivation(ctx, text);
    return;
  }

  if (session.state === 'SEARCH_AWAIT_QUERY') {
    await SessionService.clearSession(telegramId);
  }
  await StudentHandler.handleSearchQuery(ctx, text);
});

bot.catch((error, ctx) => {
  console.error('Telegram update failed:', error);
  if (ctx) void ctx.reply('حدثت مشكلة أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.');
});
