import Fuse from 'fuse.js';
import { supabase } from '../config/supabase';
import type { Course, Lecture, Term } from '../types/database';

export type LectureSearchResult = Lecture & {
  course_name: string;
  doctor_name: string;
};

export async function searchLectures(
  queryStr: string,
  departmentId: string
): Promise<LectureSearchResult[]> {
  try {
    const trimmedQuery = queryStr.trim();

    const { data: activeTerm, error: termError } = await supabase
      .from('terms')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (termError) {
      throw termError;
    }

    if (!activeTerm) {
      return [];
    }

    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select('*')
      .eq('department_id', departmentId)
      .eq('term_id', (activeTerm as Term).id);

    if (coursesError) {
      throw coursesError;
    }

    if (!courses || courses.length === 0) {
      return [];
    }

    const courseIds = courses.map((course) => course.id);

    const { data: lectures, error: lecturesError } = await supabase
      .from('lectures')
      .select('*')
      .in('course_id', courseIds);

    if (lecturesError) {
      throw lecturesError;
    }

    if (!lectures || lectures.length === 0) {
      return [];
    }

    const courseMap = new Map<string, Course>((courses as Course[]).map((course) => [course.id, course]));

    const enrichedLectures: LectureSearchResult[] = (lectures as Lecture[]).map((lecture) => {
      const course = courseMap.get(lecture.course_id);

      return {
        ...lecture,
        course_name: course?.name ?? 'غير معروف',
        doctor_name: course?.doctor_name ?? 'غير معروف',
      };
    });

    if (!trimmedQuery) {
      return enrichedLectures.sort((a, b) => (b.lecture_number ?? 0) - (a.lecture_number ?? 0));
    }

    const fuse = new Fuse(enrichedLectures, {
      keys: ['title', 'course_name', 'doctor_name'],
      includeScore: true,
      threshold: 0.45,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });

    return fuse
      .search(trimmedQuery)
      .map((result) => result.item)
      .sort((a, b) => (b.lecture_number ?? 0) - (a.lecture_number ?? 0));
  } catch (error) {
    console.error('Lecture search error:', error);
    return [];
  }
}
