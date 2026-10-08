import { supabase } from '../config/supabase';
import type { Student } from '../types/database';

export type StudentStatus = {
  exists: boolean;
  active: boolean;
  student: Student | null;
};

export type ActivationResult = {
  status: 'activated' | 'already_active' | 'invalid_code' | 'error';
  message: string;
  student?: Student;
};

export async function checkStudentStatus(telegramId: number): Promise<StudentStatus> {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) {
      return {
        exists: false,
        active: false,
        student: null,
      };
    }

    return {
      exists: true,
      active: Boolean(data.is_active),
      student: data as Student,
    };
  } catch (error) {
    console.error('Error checking student status:', error);
    return {
      exists: false,
      active: false,
      student: null,
    };
  }
}

export async function activateAccount(
  telegramId: number,
  name: string,
  codeStr: string
): Promise<ActivationResult> {
  const normalizedName = name.trim();
  const normalizedCode = codeStr.trim().toUpperCase();

  if (!normalizedCode || !/^[A-Z0-9-]{6,12}$/.test(normalizedCode)) {
    return {
      status: 'invalid_code',
      message: 'رمز التفعيل غير صحيح. تأكد من كتابته بشكل صحيح.',
    };
  }

  try {
    const existingStatus = await checkStudentStatus(telegramId);

    if (existingStatus.active) {
      return {
        status: 'already_active',
        message: 'حسابك مفعّل بالفعل، يمكنك استخدام البوت الآن.',
        student: existingStatus.student ?? undefined,
      };
    }

    const { data: activationCode, error: activationError } = await supabase
      .from('activation_codes')
      .select('*')
      .eq('code', normalizedCode)
      .maybeSingle();

    if (activationError) {
      throw activationError;
    }

    if (!activationCode || activationCode.is_used) {
      return {
        status: 'invalid_code',
        message: 'رمز التفعيل غير صالح أو تم استخدامه من قبل.',
      };
    }

    const studentPayload = {
      telegram_id: telegramId,
      full_name: normalizedName || `Student-${telegramId}`,
      department_id: activationCode.department_id,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    const { data: createdStudent, error: insertError } = await supabase
      .from('students')
      .insert([studentPayload])
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        const { data: updatedStudent, error: updateError } = await supabase
          .from('students')
          .update({
            full_name: normalizedName || `Student-${telegramId}`,
            department_id: activationCode.department_id,
            is_active: true,
          })
          .eq('telegram_id', telegramId)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        const { error: codeUpdateError } = await supabase
          .from('activation_codes')
          .update({
            is_used: true,
            used_by_telegram_id: telegramId,
          })
          .eq('code', normalizedCode);

        if (codeUpdateError) {
          throw codeUpdateError;
        }

        return {
          status: 'activated',
          message: 'تم تفعيل حسابك بنجاح، يمكنك الآن البحث عن المحاضرات.',
          student: updatedStudent as Student,
        };
      }

      throw insertError;
    }

    const { error: codeUpdateError } = await supabase
      .from('activation_codes')
      .update({
        is_used: true,
        used_by_telegram_id: telegramId,
      })
      .eq('code', normalizedCode);

    if (codeUpdateError) {
      throw codeUpdateError;
    }

    return {
      status: 'activated',
      message: 'تم تفعيل حسابك بنجاح، يمكنك الآن البحث عن المحاضرات.',
      student: createdStudent as Student,
    };
  } catch (error) {
    console.error('Activation failed:', error);
    return {
      status: 'error',
      message: 'حدثت مشكلة أثناء تفعيل الحساب. يرجى المحاولة مرة أخرى.',
    };
  }
}
