import { supabase } from '../config/supabase';
import type { Course, Lecture } from '../types/database';

export async function getStudentCourses(telegramId: number): Promise<Course[]> {
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('department_id, is_active')
    .eq('telegram_id', telegramId)
    .maybeSingle();
  if (studentError) throw studentError;
  if (!student?.is_active) return [];

  const { data: activeTerm, error: termError } = await supabase
    .from('terms')
    .select('id')
    .eq('is_active', true)
    .maybeSingle();
  if (termError) throw termError;
  if (!activeTerm) return [];

  const { data: courses, error: coursesError } = await supabase
    .from('courses')
    .select('id, department_id, term_id, name, doctor_name')
    .eq('department_id', student.department_id)
    .eq('term_id', activeTerm.id)
    .order('name');
  if (coursesError) throw coursesError;

  return (courses ?? []) as Course[];
}

export async function getCourseLectures(courseId: string): Promise<Lecture[]> {
  const { data: lectures, error } = await supabase
    .from('lectures')
    .select('*')
    .eq('course_id', courseId)
    .order('lecture_number', { ascending: true, nullsFirst: false });
  if (error) throw error;

  return (lectures ?? []) as Lecture[];
}