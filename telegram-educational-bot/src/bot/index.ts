import { Telegraf, Context } from 'telegraf';
import { activateAccount, checkStudentStatus } from '../services/auth';
import { searchLectures } from '../services/search';

const botToken = process.env.BOT_TOKEN;

if (!botToken) {
  throw new Error('Missing BOT_TOKEN environment variable.');
}

type StudentStatus = Awaited<ReturnType<typeof checkStudentStatus>>;

type BotContext = Context & {
  state: {
    isActivated?: boolean;
    studentStatus?: StudentStatus;
  };
};

export const bot = new Telegraf<BotContext>(botToken);

const looksLikeActivationCode = (value: string): boolean => /^[A-Z0-9-]{6,12}$/i.test(value.trim());

bot.use(async (ctx, next) => {
  const telegramId = Number(ctx.from?.id);

  if (!telegramId) {
    return next();
  }

  try {
    const status = await checkStudentStatus(telegramId);
    ctx.state.studentStatus = status;
    ctx.state.isActivated = status.active;
  } catch (error) {
    console.error('Middleware error while checking student status:', error);
  }

  return next();
});

bot.start(async (ctx) => {
  const telegramId = Number(ctx.from?.id);

  if (!telegramId) {
    return;
  }

  const status = ctx.state.studentStatus ?? (await checkStudentStatus(telegramId));

  if (!status.active) {
    await ctx.reply(
      'مرحباً 👋\nأهلا بك في بوت المحاضرات التعليمية.\nيرجى إرسال رمز التفعيل الخاص بك لتفعيل الحساب.'
    );
    return;
  }

  await ctx.reply(
    `مرحباً ${ctx.from?.first_name ?? 'الطالب'} 👋\nحسابك مفعّل بنجاح، يمكنك الآن البحث عن المحاضرات وأي ملف مطلوب.`
  );
});

bot.on('text', async (ctx) => {
  const telegramId = Number(ctx.from?.id);
  const text = ctx.message.text.trim();

  if (!telegramId) {
    return;
  }

  const status = ctx.state.studentStatus ?? (await checkStudentStatus(telegramId));

  if (!status.active) {
    if (!looksLikeActivationCode(text)) {
      await ctx.reply('أنت غير مفعّل بعد. أرسل رمز التفعيل الخاص بك لتفعيل الحساب.');
      return;
    }

    const fullName = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ') || 'طالب';
    const activationResult = await activateAccount(telegramId, fullName, text);

    await ctx.reply(activationResult.message);
    return;
  }

  const departmentId = status.student?.department_id;

  if (!departmentId) {
    await ctx.reply('تعذر العثور على قسمك الحالي. يرجى التواصل مع الإدارة.');
    return;
  }

  try {
    const matches = await searchLectures(text, departmentId);

    if (matches.length === 0) {
      await ctx.reply('لم يتم العثور على نتائج مطابقة لبحثك. جرّب عنوان محاضرة أو اسم المادة أو اسم الدكتور.');
      return;
    }

    await ctx.reply(`تم العثور على ${matches.length} نتيجة تطابق بحثك:`);

    for (const lecture of matches.slice(0, 5)) {
      await ctx.reply(
        `📚 ${lecture.title}\n` +
          `المادة: ${lecture.course_name}\n` +
          `الدكتور: ${lecture.doctor_name}\n` +
          `المحاضرة: ${lecture.lecture_number}`
      );

      if (lecture.telegram_file_id) {
        await ctx.telegram.sendDocument(ctx.chat.id, {
          file_id: lecture.telegram_file_id,
        });
      }
    }
  } catch (error) {
    console.error('Bot search error:', error);
    await ctx.reply('حدث خطأ أثناء البحث عن المحاضرات. يرجى المحاولة مرة أخرى.');
  }
});

bot.catch((error, ctx) => {
  console.error('Telegraf error:', error);
  if (ctx) {
    void ctx.reply('حدثت مشكلة في البوت. يرجى المحاولة مرة أخرى في وقت لاحق.');
  }
});
