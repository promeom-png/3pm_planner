export interface Goal {
  id: string;
  title: string;
  description: string;
  category: 'professional' | 'personal' | 'financial' | 'health';
  targetDate: string;
  time: string;
  color: string;
  progress: number; // 0 to 100
  status: 'active' | 'completed' | 'on-hold';
  tasks: Task[];
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  date?: string;
  time?: string;
  color?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO string
  end: string; // ISO string
  location?: string;
  category: string;
  color: string;
  goalId?: string; // Optional link to a goal
  completed?: boolean;
  isRecurring?: boolean;
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
    endDate: string; // ISO string
    daysOfWeek?: number[]; // 0-6 for weekly
  };
}

export interface DayAchievement {
  id: string;
  date: string; // YYYY-MM-DD
  content: string;
  createdAt: string;
  type?: 'manual' | 'habit';
}

export interface Habit {
  id: string;
  title: string;
  category: 'personal' | 'professional';
  completedDates: string[]; // Array of YYYY-MM-DD
  acquired: boolean;
  streak: number;
}

export interface Note {
  id: string;
  content: string;
  createdAt: string;
  audioUrl?: string;
  type: 'text' | 'voice';
}

export interface Category {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface GoogleAccount {
  id: string;
  email: string;
  accessToken?: string;
  refreshToken?: string;
  expiryDate?: number;
  isAuthorized: boolean;
  syncType?: 'oauth' | 'ical';
  icalUrl?: string;
}

export interface GoogleCalendarEvent extends CalendarEvent {
  googleEventId: string;
  googleAccountId: string;
}

export interface PerfectScheduleSlot {
  categoryId?: string;
  customText?: string;
}

export interface PerfectSchedule {
  slots: { [key: string]: PerfectScheduleSlot }; // key format: "day-hour" e.g., "1-9" for Monday 9:00
}
