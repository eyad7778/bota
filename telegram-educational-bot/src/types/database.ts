export interface Student {
  telegram_id: number;
  full_name: string;
  department_id: string;
  is_active: boolean;
  created_at: string;
}

export interface ActivationCode {
  code: string;
  department_id: string;
  is_used: boolean;
  used_by_telegram_id: number | null;
}

export interface Course {
  id: string;
  department_id: string;
  term_id: string;
  name: string;
  doctor_name: string;
}

export interface Lecture {
  id: string;
  course_id: string;
  title: string;
  lecture_number: number;
  telegram_file_id: string;
  created_at: string;
}

export interface Term {
  id: string;
  name: string;
  is_active: boolean;
}
