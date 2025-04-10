export interface Course {
  id: string;
  code: string;
  name: string;
  description: string | null;
  max_seats: number;
  available_seats: number;
  created_at: string | null;
  instructor: string | null;
  credits: number | null;
  department: string | null;
}

export interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  status: 'enrolled' | 'waitlisted';
  created_at: string | null;
  grade: string | null;
}

export interface User {
  id: string;
  email: string;
}