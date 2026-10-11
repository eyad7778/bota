import { checkStudentStatus } from '../services/auth';
import { getCourseLectures, getStudentCourses } from '../services/courseService';
import { supabase } from '../config/supabase';
import type { Lecture } from '../types/database';
import { verifyTelegramWebAppData } from './verifyTelegram';

export type MiniAppResponse = {
  status: number;
  body: Record<string, unknown>;
};

type MiniAppStudent = {
  telegramId: number;
  departmentId: string;
};

async function authorizeStudent(initData: unknown): Promise<MiniAppStudent | MiniAppResponse> {
  if (typeof initData !== 'string' || !verifyTelegramWebAppData(initData)) {
    return { status: 401, body: { error: 'Invalid or expired Telegram session.' } };
  }

  try {
    const userData = new URLSearchParams(initData).get('user');
    const user: unknown = userData ? JSON.parse(userData) : null;
    if (!user || typeof user !== 'object' || !('id' in user) ||
      !Number.isSafeInteger(user.id) || (user.id as number) <= 0) {
      return { status: 401, body: { error: 'Invalid Telegram user data.' } };
    }

    const telegramId = user.id as number;
    const status = await checkStudentStatus(telegramId);
    if (!status.active || !status.student?.department_id) {
      return { status: 403, body: { error: 'Student account is not active.' } };
    }

    return { telegramId, departmentId: status.student.department_id };
  } catch {
    return { status: 401, body: { error: 'Invalid Telegram user data.' } };
  }
}

function isErrorResponse(value: MiniAppStudent | MiniAppResponse): value is MiniAppResponse {
  return 'status' in value;
}

export async function getMiniAppCourses(initData: unknown): Promise<MiniAppResponse> {
  const student = await authorizeStudent(initData);
  if (isErrorResponse(student)) return student;

  try {
    const courses = await getStudentCourses(student.telegramId);
    return {
      status: 200,
      body: {
        courses: courses.map(({ id, name, doctor_name }) => ({ id, name, doctor_name })),
      },
    };
  } catch (error) {
    console.error('Mini App course lookup failed:', error);
    return { status: 500, body: { error: 'Unable to load courses.' } };
  }
}

export async function getMiniAppLectures(
  initData: unknown,
  courseId: unknown
): Promise<MiniAppResponse> {
  const student = await authorizeStudent(initData);
  if (isErrorResponse(student)) return student;
  if (typeof courseId !== 'string' || !courseId) {
    return { status: 400, body: { error: 'A course ID is required.' } };
  }

  try {
    const courses = await getStudentCourses(student.telegramId);
    if (!courses.some((course) => course.id === courseId && course.department_id === student.departmentId)) {
      return { status: 403, body: { error: 'Course is not available to this student.' } };
    }

    const lectures = await getCourseLectures(courseId);
    return {
      status: 200,
      body: {
        lectures: lectures.map(({ id, title, lecture_number, doctor_name, file_type, content_text, telegram_file_id }) => ({
          id,
          title,
          lecture_number,
          doctor_name,
          file_type,
          content_text,
          has_file: Boolean(telegram_file_id),
        })),
      },
    };
  } catch (error) {
    console.error('Mini App lecture lookup failed:', error);
    return { status: 500, body: { error: 'Unable to load lectures.' } };
  }
}

export async function getMiniAppLectureForDelivery(
  initData: unknown,
  lectureId: unknown
): Promise<{ telegramId: number; lecture: Lecture } | MiniAppResponse> {
  const student = await authorizeStudent(initData);
  if (isErrorResponse(student)) return student;
  if (typeof lectureId !== 'string' || !lectureId) {
    return { status: 400, body: { error: 'A lecture ID is required.' } };
  }

  try {
    const { data: lecture, error: lectureError } = await supabase
      .from('lectures')
      .select('*')
      .eq('id', lectureId)
      .maybeSingle();
    if (lectureError) throw lectureError;
    if (!lecture) return { status: 404, body: { error: 'Lecture was not found.' } };

    const courses = await getStudentCourses(student.telegramId);
    if (!courses.some((course) => course.id === lecture.course_id && course.department_id === student.departmentId)) {
      return { status: 403, body: { error: 'Lecture is not available to this student.' } };
    }

    return { telegramId: student.telegramId, lecture: lecture as Lecture };
  } catch (error) {
    console.error('Mini App lecture authorization failed:', error);
    return { status: 500, body: { error: 'Unable to open lecture.' } };
  }
}