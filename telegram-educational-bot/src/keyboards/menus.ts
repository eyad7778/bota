import { Markup } from 'telegraf';

export const getMainMenu = () =>
  Markup.keyboard([
    ['📚 المحاضرات', '🔍 البحث عن محاضرة'],
    ['👤 حسابي', '🛠️ لوحة الإدارة'],
  ]).resize();

export const getAdminMenu = () =>
  Markup.keyboard([
    ['📤 نشر محاضرة أو محتوى', '📢 إرسال إعلان'],
    ['📚 إدارة المواد', '🎟️ أرقام التفعيل'],
    ['👥 إدارة الطلاب', '📅 إضافة موعد'],
    ['📊 عرض الإحصائيات', '🏠 القائمة الرئيسية'],
  ]).resize();

export const getCancelKeyboard = () => Markup.keyboard([['❌ إلغاء العملية']]).resize();
