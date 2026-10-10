export type FileType = 'pdf' | 'document' | 'audio' | 'voice' | 'text';

export type SessionState =
  | 'IDLE'
  | 'AWAITING_CODE'
  | 'ADMIN_ADD_SUBJECT'
  | 'ADMIN_SELECT_COURSE_DEPARTMENT'
  | 'ADMIN_CREATE_COURSE_NAME'
  | 'ADMIN_CREATE_COURSE_DOCTOR'
  | 'ADMIN_EDIT_COURSE_NAME'
  | 'ADMIN_EDIT_COURSE_DOCTOR'
  | 'ADMIN_ADD_EVENT_TITLE'
  | 'ADMIN_ADD_EVENT_DATE'
  | 'ADMIN_PUB_SELECT_SUBJECT'
  | 'ADMIN_PUB_SELECT_TYPE'
  | 'ADMIN_PUB_ENTER_NUMBER'
  | 'ADMIN_PUB_ENTER_TITLE'
  | 'ADMIN_PUB_ENTER_DOCTOR'
  | 'ADMIN_PUB_AWAIT_FILE'
  | 'ADMIN_PUB_CONFIRM'
  | 'ADMIN_SEND_ANNOUNCEMENT'
  | 'SEARCH_AWAIT_QUERY';

export interface BotSession {
  telegram_id: number;
  state: SessionState;
  step?: string;
  payload: Record<string, any>;
}

export interface Student {
  id: string;
  telegram_id: number;
  department_id?: string;
  is_active: boolean;
  created_at: string;
}

export interface Subject {
  id: string;
  name: string;
  code?: string;
}

export interface Lecture {
  id: string;
  subject_id: string;
  lecture_number?: number;
  title: string;
  doctor_name?: string;
  file_id?: string;
  file_type: FileType;
  content_text?: string;
  created_at: string;
}
