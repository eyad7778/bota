CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  telegram_id BIGINT PRIMARY KEY,
  full_name TEXT NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activation_codes (
  code TEXT PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  used_by_telegram_id BIGINT NULL REFERENCES students(telegram_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  term_id UUID NOT NULL REFERENCES terms(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  doctor_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lectures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  lecture_number INTEGER NOT NULL,
  telegram_file_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE lectures ALTER COLUMN lecture_number DROP NOT NULL;
ALTER TABLE lectures ALTER COLUMN telegram_file_id DROP NOT NULL;
ALTER TABLE lectures ADD COLUMN IF NOT EXISTS doctor_name TEXT;
ALTER TABLE lectures ADD COLUMN IF NOT EXISTS file_type TEXT NOT NULL DEFAULT 'document';
ALTER TABLE lectures ADD COLUMN IF NOT EXISTS content_text TEXT;

CREATE TABLE IF NOT EXISTS bot_sessions (
  telegram_id BIGINT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'IDLE',
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schedule_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_department_id
  ON students (department_id);

CREATE INDEX IF NOT EXISTS idx_activation_codes_department_id
  ON activation_codes (department_id);

CREATE INDEX IF NOT EXISTS idx_courses_department_term
  ON courses (department_id, term_id);

CREATE INDEX IF NOT EXISTS idx_lectures_course_id
  ON lectures (course_id);

CREATE INDEX IF NOT EXISTS idx_terms_is_active
  ON terms (is_active);
