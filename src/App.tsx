import React, { useState, useEffect, useCallback } from 'react';
import { format, parseISO, isToday, isSameDay } from 'date-fns';
import { 
  Calendar as CalendarIcon, 
  Target, 
  Settings, 
  LogOut, 
  Bell, 
  Search,
  LayoutDashboard,
  CheckSquare,
  StickyNote,
  Download,
  Upload,
  Plus,
  X,
  HelpCircle,
  AlertCircle,
  ChevronRight,
  TrendingUp,
  CheckCircle2,
  Clock,
  Check,
  Key,
  LogIn
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Calendar from './components/Calendar';
import Goals from './components/Goals';
import Notes from './components/Notes';
import PerfectScheduleView from './components/PerfectSchedule';
import { CalendarEvent, Goal, Note, DayAchievement, Habit, Category, GoogleAccount, GoogleCalendarEvent, PerfectSchedule } from './types';
import { cn } from './lib/utils';
import { CLIENT_COLORS } from './constants';
import { NATIONAL_HOLIDAYS, SPAIN_REGIONAL_HOLIDAYS } from './holidays';
import { Toaster, toast } from 'sonner';
import { auth, db, loginWithEmail, logout, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, doc, setDoc, updateDoc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  subMonths, 
  isWithinInterval, 
  getDay, 
  getHours, 
  startOfDay, 
  addDays,
  differenceInWeeks
} from 'date-fns';

// Mock Data
const INITIAL_EVENTS: CalendarEvent[] = [];

const INITIAL_GOALS: Goal[] = [];

const INITIAL_HABITS: Habit[] = [
  { id: 'p1', title: 'Meditar 10 min', category: 'personal', completedDates: [], acquired: false, streak: 0 },
  { id: 'p2', title: 'Leer 20 pág', category: 'personal', completedDates: [], acquired: false, streak: 0 },
  { id: 'p3', title: 'Hacer ejercicio', category: 'personal', completedDates: [], acquired: false, streak: 0 },
  { id: 'w1', title: 'Revisar métricas', category: 'professional', completedDates: [], acquired: false, streak: 0 },
  { id: 'w2', title: 'Planificar mañana', category: 'professional', completedDates: [], acquired: false, streak: 0 },
  { id: 'w3', title: 'Inbox Zero', category: 'professional', completedDates: [], acquired: false, streak: 0 },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'calendar' | 'goals' | 'dashboard' | 'notes' | 'settings'>('dashboard');
  const [defaultTab, setDefaultTab] = useState<'calendar' | 'goals' | 'dashboard' | 'notes' | 'settings'>('dashboard');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [workDayStart, setWorkDayStart] = useState(7);
  const [workDayEnd, setWorkDayEnd] = useState(20);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(CLIENT_COLORS[0]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showHolidays, setShowHolidays] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('España');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [workEndNotify, setWorkEndNotify] = useState(false);
  const [workEndTime, setWorkEndTime] = useState('20:00');
  const [workEndDays, setWorkEndDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [dayAchievements, setDayAchievements] = useState<DayAchievement[]>([]);
  const [habits, setHabits] = useState<Habit[]>(INITIAL_HABITS);
  const [googleAccounts, setGoogleAccounts] = useState<GoogleAccount[]>([]);
  const [newGoogleEmail, setNewGoogleEmail] = useState('');
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [showDayClosure, setShowDayClosure] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [perfectSchedule, setPerfectSchedule] = useState<PerfectSchedule>({ slots: {} });
  const [showPerfectSchedule, setShowPerfectSchedule] = useState(false);
  const lastNotifiedRef = React.useRef<string | null>(null);
  const lastClosureRef = React.useRef<string | null>(null);
  const lastAlignmentAchievementRef = React.useRef<string | null>(null);

  const achievementsRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (achievementsRef.current) {
      achievementsRef.current.scrollTop = 0;
    }
  }, [dayAchievements, events, goals]);

  useEffect(() => {
    testConnection();
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Firebase Real-time Sync
  useEffect(() => {
    if (!user) {
      setIsLoaded(false);
      return;
    }

    const userPath = `users/${user.uid}`;
    
    // Sync Goals
    const unsubscribeGoals = onSnapshot(collection(db, userPath, 'goals'), (snapshot) => {
      const goalsData = snapshot.docs.map(doc => doc.data() as Goal);
      setGoals(goalsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `${userPath}/goals`));

    // Sync Events
    const unsubscribeEvents = onSnapshot(collection(db, userPath, 'events'), (snapshot) => {
      const eventsData = snapshot.docs.map(doc => doc.data() as CalendarEvent);
      setEvents(eventsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `${userPath}/events`));

    // Sync Notes
    const unsubscribeNotes = onSnapshot(collection(db, userPath, 'notes'), (snapshot) => {
      const notesData = snapshot.docs.map(doc => doc.data() as Note);
      setNotes(notesData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `${userPath}/notes`));

    // Sync Achievements
    const unsubscribeAchievements = onSnapshot(collection(db, userPath, 'achievements'), (snapshot) => {
      const achievementsData = snapshot.docs.map(doc => doc.data() as DayAchievement);
      setDayAchievements(achievementsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `${userPath}/achievements`));

    // Sync Habits
    const unsubscribeHabits = onSnapshot(collection(db, userPath, 'habits'), (snapshot) => {
      const habitsData = snapshot.docs.map(doc => doc.data() as Habit);
      if (habitsData.length > 0) {
        setHabits(habitsData);
      } else {
        setHabits(INITIAL_HABITS);
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, `${userPath}/habits`));

    // Sync Google Accounts
    const unsubscribeGoogleAccounts = onSnapshot(collection(db, userPath, 'googleAccounts'), (snapshot) => {
      const accounts = snapshot.docs.map(doc => doc.data() as GoogleAccount);
      setGoogleAccounts(accounts);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `${userPath}/googleAccounts`));

    // Sync Settings
    const unsubscribeSettings = onSnapshot(doc(db, userPath, 'settings', 'current'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.theme) setTheme(data.theme);
        if (data.categories) setCategories(data.categories);
        if (data.workDayStart) setWorkDayStart(data.workDayStart);
        if (data.workDayEnd) setWorkDayEnd(data.workDayEnd);
        if (data.defaultTab) {
          setDefaultTab(data.defaultTab);
          setActiveTab(prev => prev === 'dashboard' ? data.defaultTab : prev);
        }
        if (data.showHolidays !== undefined) setShowHolidays(data.showHolidays);
        if (data.selectedCountry) setSelectedCountry(data.selectedCountry);
        if (data.selectedRegion) setSelectedRegion(data.selectedRegion);
        if (data.workEndNotify !== undefined) setWorkEndNotify(data.workEndNotify);
        if (data.workEndTime) setWorkEndTime(data.workEndTime);
        if (data.workEndDays) setWorkEndDays(data.workEndDays);
        if (data.perfectSchedule) setPerfectSchedule(data.perfectSchedule);
      }
      setIsLoaded(true);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `${userPath}/settings/current`);
      setIsLoaded(true); // Still set to true on error to allow app to function
    });

    return () => {
      unsubscribeGoals();
      unsubscribeEvents();
      unsubscribeNotes();
      unsubscribeAchievements();
      unsubscribeHabits();
      unsubscribeGoogleAccounts();
      unsubscribeSettings();
    };
  }, [user]);

  // Fetch Google Events
  useEffect(() => {
    if (!user || googleAccounts.length === 0) {
      setGoogleEvents([]);
      return;
    }

    const fetchAllGoogleEvents = async () => {
      const allGoogleEvents: GoogleCalendarEvent[] = [];
      for (const account of googleAccounts) {
        if (!account.isAuthorized && account.syncType !== 'ical') continue;
        try {
          let response;
          if (account.syncType === 'ical' && account.icalUrl) {
            response = await fetch(`/api/calendar/ical?url=${encodeURIComponent(account.icalUrl)}`);
          } else {
            response = await fetch(`/api/google-calendar/events?userId=${user.uid}&accountId=${account.id}`);
          }
          
          if (response.ok) {
            const data = await response.json();
            allGoogleEvents.push(...data);
          }
        } catch (error) {
          console.error(`Error fetching events for ${account.email}:`, error);
        }
      }
      setGoogleEvents(allGoogleEvents);
    };

    fetchAllGoogleEvents();
    const interval = setInterval(fetchAllGoogleEvents, 1000 * 60 * 5); // Refresh every 5 mins
    return () => clearInterval(interval);
  }, [user, googleAccounts]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        toast.success("Cuenta de Google conectada correctamente");
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Data Migration from LocalStorage to Firebase
  useEffect(() => {
    const bootstrapIcal = async () => {
      if (!user || user.email !== 'promeom@gmail.com') return;
      
      const userPath = `users/${user.uid}`;
      const icalLinks = [
        {
          email: 'promeom@gmail.com (Privado)',
          url: 'https://calendar.google.com/calendar/ical/promeom%40gmail.com/private-bce0178ce3dc5c4ea18f4df2cd666be1/basic.ics'
        },
        {
          email: 'smileconsultores@gmail.com (Privado)',
          url: 'https://calendar.google.com/calendar/ical/smileconsultores%40gmail.com/private-a601a785fc073f791ab0e368361b7e60/basic.ics'
        }
      ];

      for (const link of icalLinks) {
        const accountId = btoa(link.url);
        const alreadyExists = googleAccounts.some(acc => acc.icalUrl === link.url);
        
        if (!alreadyExists) {
          try {
            await setDoc(doc(db, userPath, 'googleAccounts', accountId), {
              id: accountId,
              email: link.email,
              isAuthorized: true,
              syncType: 'ical',
              icalUrl: link.url
            });
            console.log(`Bootstrapped iCal for ${link.email}`);
          } catch (e) {
            console.error(`Error bootstrapping iCal for ${link.email}:`, e);
          }
        }
      }
    };

    bootstrapIcal();
  }, [user, googleAccounts]);

  // Data Migration from LocalStorage to Firebase
  useEffect(() => {
    const migrateData = async () => {
      if (!user || !isLoaded) return;
      
      const userPath = `users/${user.uid}`;
      const goalsSnap = await getDocs(collection(db, userPath, 'goals'));
      
      // Only migrate if Firestore is empty
      if (goalsSnap.empty) {
        const batch = writeBatch(db);
        
        const savedEvents = localStorage.getItem('pablo_events');
        const savedGoals = localStorage.getItem('pablo_goals');
        const savedNotes = localStorage.getItem('pablo_notes');
        const savedDayAchievements = localStorage.getItem('pablo_dayAchievements');
        const savedHabits = localStorage.getItem('pablo_habits');

        if (savedEvents) {
          JSON.parse(savedEvents).forEach((e: CalendarEvent) => {
            batch.set(doc(db, userPath, 'events', e.id), e);
          });
        }
        if (savedGoals) {
          JSON.parse(savedGoals).forEach((g: Goal) => {
            batch.set(doc(db, userPath, 'goals', g.id), g);
          });
        }
        if (savedNotes) {
          JSON.parse(savedNotes).forEach((n: Note) => {
            batch.set(doc(db, userPath, 'notes', n.id), n);
          });
        }
        if (savedDayAchievements) {
          JSON.parse(savedDayAchievements).forEach((a: DayAchievement) => {
            batch.set(doc(db, userPath, 'achievements', a.id), a);
          });
        }
        if (savedHabits) {
          JSON.parse(savedHabits).forEach((h: Habit) => {
            batch.set(doc(db, userPath, 'habits', h.id), h);
          });
        }

        // Migrate Settings
        const settings = {
          theme,
          categories,
          workDayStart,
          workDayEnd,
          defaultTab,
          showHolidays,
          selectedCountry,
          selectedRegion,
          workEndNotify,
          workEndTime,
          workEndDays,
          perfectSchedule
        };
        batch.set(doc(db, userPath, 'settings', 'current'), settings);

        await batch.commit();
        console.log("Data migrated to Firebase");
      }
    };

    migrateData();
  }, [user, isLoaded]);

  // Save Settings to Firebase
  useEffect(() => {
    if (!user || !isLoaded) return;
    const userPath = `users/${user.uid}`;
    const settings = {
      theme,
      categories,
      workDayStart,
      workDayEnd,
      defaultTab,
      showHolidays,
      selectedCountry,
      selectedRegion,
      workEndNotify,
      workEndTime,
      workEndDays,
      perfectSchedule
    };
    setDoc(doc(db, userPath, 'settings', 'current'), settings).catch(e => handleFirestoreError(e, OperationType.WRITE, `${userPath}/settings/current`));
  }, [theme, categories, workDayStart, workDayEnd, defaultTab, showHolidays, selectedCountry, selectedRegion, workEndNotify, workEndTime, workEndDays, perfectSchedule, user, isLoaded]);

  const toggleHabitCompletion = async (id: string, date: string = format(new Date(), 'yyyy-MM-dd')) => {
    if (!user) return;
    const userPath = `users/${user.uid}`;
    const habit = habits.find(h => h.id === id);
    if (!habit) return;

    const completedDates = habit.completedDates || [];
    const isCompleted = completedDates.includes(date);
    const newCompletedDates = isCompleted 
      ? completedDates.filter(d => d !== date)
      : [...completedDates, date];
    
    // Simple streak calculation
    let streak = 0;
    let checkDate = new Date();
    while (true) {
      const dateStr = format(checkDate, 'yyyy-MM-dd');
      if (newCompletedDates.includes(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    try {
      await updateDoc(doc(db, userPath, 'habits', id), {
        completedDates: newCompletedDates,
        streak
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `${userPath}/habits/${id}`);
    }
  };

  const toggleHabitAcquired = async (id: string) => {
    if (!user) return;
    const userPath = `users/${user.uid}`;
    const habit = habits.find(h => h.id === id);
    if (!habit) return;

    const newAcquired = !habit.acquired;
    
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, userPath, 'habits', id), { acquired: newAcquired });
      
      if (newAcquired) {
        const achievementId = Math.random().toString(36).substr(2, 9);
        const achievement = {
          id: achievementId,
          date: format(new Date(), 'yyyy-MM-dd'),
          content: habit.title,
          createdAt: new Date().toISOString(),
          type: 'habit'
        };
        batch.set(doc(db, userPath, 'achievements', achievementId), achievement);
      }
      
      await batch.commit();
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `${userPath}/habits/${id}`);
    }
  };

  // Work end notification and Day Closure logic
  useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      const currentDay = now.getDay();
      const currentTimeStr = format(now, 'HH:mm');
      const todayStr = format(now, 'yyyy-MM-dd');

      // Notification logic
      if (workEndNotify && workEndDays.includes(currentDay) && currentTimeStr === workEndTime) {
        if (lastNotifiedRef.current !== currentTimeStr) {
          playPlink();
          lastNotifiedRef.current = currentTimeStr;
          
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Fin de Jornada", {
              body: "¡Es hora de terminar de trabajar! ¡Plink!",
              icon: "/favicon.ico"
            });
          } else if ("Notification" in window && Notification.permission !== "denied") {
            Notification.requestPermission();
          }
        }
      } else {
        lastNotifiedRef.current = null;
      }

      // Day Closure logic (always use workDayEnd)
      const closureTime = `${workDayEnd.toString().padStart(2, '0')}:00`;
      if (currentTimeStr === closureTime) {
        if (lastClosureRef.current !== todayStr) {
          setShowDayClosure(true);
          lastClosureRef.current = todayStr;
        }
      }
    };

    const interval = setInterval(checkTime, 10000);
    return () => clearInterval(interval);
  }, [workEndNotify, workEndTime, workEndDays, workDayEnd]);

  const playPlink = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
      oscillator.frequency.exponentialRampToValueAtTime(1760, audioContext.currentTime + 0.1); // A6

      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      console.error("Audio error:", e);
    }
  };

  const handleBackup = () => {
    const data = {
      events,
      goals,
      notes,
      version: '1.0',
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const userPrefix = user.email?.split('@')[0] || 'user';
    link.download = `${userPrefix}_backup_${format(new Date(), 'yyyyMMdd_HHmm')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.events) setEvents(data.events);
        if (data.goals) setGoals(data.goals);
        if (data.notes) setNotes(data.notes);
        alert('Copia de seguridad restaurada con éxito');
      } catch (err) {
        alert('Error al restaurar la copia de seguridad. Asegúrate de que el archivo sea válido.');
      }
    };
    reader.readAsText(file);
  };

  const navItems = [
    { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
    { id: 'calendar', label: 'Agenda', icon: CalendarIcon },
    { id: 'goals', label: 'Metas', icon: Target },
    { id: 'notes', label: 'Notas', icon: StickyNote },
    { id: 'settings', label: 'Ajustes', icon: Settings },
  ];

  const handleAddEvent = async (eventData: Omit<CalendarEvent, 'id'>) => {
    if (!user) {
      toast.error("Debes iniciar sesión para añadir citas");
      return;
    }
    const userPath = `users/${user.uid}`;
    const id = Math.random().toString(36).substr(2, 9);
    const newEvent: CalendarEvent = { id, ...eventData };

    try {
      const batch = writeBatch(db);
      // Remove undefined fields to prevent Firestore errors
      const cleanedEvent = Object.fromEntries(
        Object.entries(newEvent).filter(([_, v]) => v !== undefined)
      );
      batch.set(doc(db, userPath, 'events', id), cleanedEvent);

      if (eventData.goalId) {
        const goal = goals.find(g => g.id === eventData.goalId);
        if (goal) {
          const updatedEvents = [...events, newEvent];
          const goalEvents = updatedEvents.filter(e => e.goalId === goal.id);
          const totalItems = goal.tasks.length + goalEvents.length;
          const completedItems = goal.tasks.filter(t => t.completed).length + goalEvents.filter(e => e.completed).length;
          const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
          batch.update(doc(db, userPath, 'goals', goal.id), { progress });
        }
      }
      await batch.commit();
    } catch (e) {
      toast.error("Error al guardar la cita");
      handleFirestoreError(e, OperationType.WRITE, `${userPath}/events/${id}`);
    }
  };

  const handleUpdateEvent = async (updatedEvent: CalendarEvent) => {
    if (!user) return;
    const userPath = `users/${user.uid}`;

    if (updatedEvent.id.startsWith('task-')) {
      const taskId = updatedEvent.id.replace('task-', '');
      const dateObj = new Date(updatedEvent.start);
      const newDate = format(dateObj, 'yyyy-MM-dd');
      const newTime = format(dateObj, 'HH:mm');
      
      const goal = goals.find(g => g.tasks.some(t => t.id === taskId));
      if (goal) {
        const updatedTasks = goal.tasks.map(task => 
          task.id === taskId 
            ? { ...task, date: newDate, time: newTime, completed: updatedEvent.completed ?? task.completed } 
            : task
        );
        const goalEvents = events.filter(e => e.goalId === goal.id);
        const totalItems = updatedTasks.length + goalEvents.length;
        const completedItems = updatedTasks.filter(t => t.completed).length + goalEvents.filter(e => e.completed).length;
        const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
        
        try {
          await updateDoc(doc(db, userPath, 'goals', goal.id), { tasks: updatedTasks, progress });
          toast.success("Tarea actualizada con éxito");
        } catch (e) {
          toast.error("Error al actualizar la tarea");
          handleFirestoreError(e, OperationType.UPDATE, `${userPath}/goals/${goal.id}`);
        }
      }
      return;
    }

    try {
      const batch = writeBatch(db);
      // Remove undefined fields to prevent Firestore errors
      const cleanedEvent = Object.fromEntries(
        Object.entries(updatedEvent).filter(([_, v]) => v !== undefined)
      );
      batch.set(doc(db, userPath, 'events', updatedEvent.id), cleanedEvent);

      if (updatedEvent.goalId) {
        const goal = goals.find(g => g.id === updatedEvent.goalId);
        if (goal) {
          const updatedEvents = events.map(e => e.id === updatedEvent.id ? updatedEvent : e);
          const goalEvents = updatedEvents.filter(e => e.goalId === goal.id);
          const totalItems = goal.tasks.length + goalEvents.length;
          const completedItems = goal.tasks.filter(t => t.completed).length + goalEvents.filter(e => e.completed).length;
          const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
          batch.update(doc(db, userPath, 'goals', goal.id), { progress });
        }
      }
      await batch.commit();
      toast.success("Cita actualizada con éxito");
    } catch (e) {
      toast.error("Error al actualizar la cita");
      handleFirestoreError(e, OperationType.WRITE, `${userPath}/events/${updatedEvent.id}`);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!user) return;
    const userPath = `users/${user.uid}`;

    if (eventId.startsWith('task-')) {
      const taskId = eventId.replace('task-', '');
      const goal = goals.find(g => g.tasks.some(t => t.id === taskId));
      if (goal) {
        const updatedTasks = goal.tasks.filter(t => t.id !== taskId);
        const goalEvents = events.filter(e => e.goalId === goal.id);
        const totalItems = updatedTasks.length + goalEvents.length;
        const completedItems = updatedTasks.filter(t => t.completed).length + goalEvents.filter(e => e.completed).length;
        const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
        
        try {
          await updateDoc(doc(db, userPath, 'goals', goal.id), { tasks: updatedTasks, progress });
        } catch (e) {
          toast.error("Error al eliminar la tarea");
          handleFirestoreError(e, OperationType.UPDATE, `${userPath}/goals/${goal.id}`);
        }
      }
      return;
    }

    const event = events.find(e => e.id === eventId);
    if (!event) return;

    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, userPath, 'events', eventId));

      if (event.goalId) {
        const goal = goals.find(g => g.id === event.goalId);
        if (goal) {
          const updatedEvents = events.filter(e => e.id !== eventId);
          const goalEvents = updatedEvents.filter(e => e.goalId === goal.id);
          const totalItems = goal.tasks.length + goalEvents.length;
          const completedItems = goal.tasks.filter(t => t.completed).length + goalEvents.filter(e => e.completed).length;
          const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
          batch.update(doc(db, userPath, 'goals', goal.id), { progress });
        }
      }
      await batch.commit();
    } catch (e) {
      toast.error("Error al eliminar la cita");
      handleFirestoreError(e, OperationType.DELETE, `${userPath}/events/${eventId}`);
    }
  };

  const toggleEventCompletion = async (eventId: string) => {
    if (!user) return;
    const userPath = `users/${user.uid}`;

    if (eventId.startsWith('task-')) {
      const taskId = eventId.replace('task-', '');
      const goal = goals.find(g => g.tasks.some(t => t.id === taskId));
      if (goal) {
        const updatedTasks = goal.tasks.map(task => 
          task.id === taskId ? { ...task, completed: !task.completed } : task
        );
        const goalEvents = events.filter(e => e.goalId === goal.id);
        const totalItems = updatedTasks.length + goalEvents.length;
        const completedItems = updatedTasks.filter(t => t.completed).length + goalEvents.filter(e => e.completed).length;
        const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
        
        try {
          await updateDoc(doc(db, userPath, 'goals', goal.id), { tasks: updatedTasks, progress });
          toast.success("Tarea actualizada con éxito");
        } catch (e) {
          toast.error("Error al actualizar la tarea");
          handleFirestoreError(e, OperationType.UPDATE, `${userPath}/goals/${goal.id}`);
        }
      }
      return;
    }

    const event = events.find(e => e.id === eventId);
    if (!event) return;

    try {
      const batch = writeBatch(db);
      const newCompleted = !event.completed;
      batch.update(doc(db, userPath, 'events', eventId), { completed: newCompleted });

      if (event.goalId) {
        const goal = goals.find(g => g.id === event.goalId);
        if (goal) {
          const updatedEvents = events.map(e => e.id === eventId ? { ...e, completed: newCompleted } : e);
          const goalEvents = updatedEvents.filter(e => e.goalId === goal.id);
          const totalItems = goal.tasks.length + goalEvents.length;
          const completedItems = goal.tasks.filter(t => t.completed).length + goalEvents.filter(e => e.completed).length;
          const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
          batch.update(doc(db, userPath, 'goals', goal.id), { progress });
        }
      }
      await batch.commit();
      toast.success(newCompleted ? "Cita completada" : "Cita pendiente");
    } catch (e) {
      toast.error("Error al actualizar el estado de la cita");
      handleFirestoreError(e, OperationType.UPDATE, `${userPath}/events/${eventId}`);
    }
  };

  const handleDeleteCategory = (index: number) => {
    setCategories(categories.filter((_, i) => i !== index));
  };

  const connectGoogleAccount = async (email?: string) => {
    if (!user) return;
    try {
      const response = await fetch(`/api/auth/google/url?userId=${user.uid}${email ? `&email=${encodeURIComponent(email)}` : ''}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      const { url } = await response.json();
      if (!url) throw new Error("No se recibió la URL de autorización");
      window.open(url, 'google_auth', 'width=600,height=700');
    } catch (error) {
      console.error("Error connecting Google account:", error);
      toast.error(error instanceof Error ? `Error al conectar: ${error.message}` : "Error al conectar con Google");
    }
  };

  const handleAddGoogleAccount = async () => {
    if (!user || !newGoogleEmail) return;

    const isIcal = newGoogleEmail.startsWith('http') && (newGoogleEmail.includes('.ics') || newGoogleEmail.includes('calendar/ical'));
    
    if (!isIcal && !newGoogleEmail.includes('@')) {
      toast.error("Por favor, introduce un email válido o una URL iCal");
      return;
    }
    
    const accountId = btoa(newGoogleEmail);
    const userPath = `users/${user.uid}`;
    
    try {
      if (isIcal) {
        await setDoc(doc(db, userPath, 'googleAccounts', accountId), {
          id: accountId,
          email: 'Calendario iCal',
          isAuthorized: true,
          syncType: 'ical',
          icalUrl: newGoogleEmail
        });
        toast.success("Calendario iCal añadido correctamente");
      } else {
        // Try to see if it's a public Google Calendar first
        const publicIcalUrl = `https://calendar.google.com/calendar/ical/${newGoogleEmail}/public/basic.ics`;
        try {
          const testRes = await fetch(`/api/calendar/ical?url=${encodeURIComponent(publicIcalUrl)}`);
          if (testRes.ok) {
            const events = await testRes.json();
            if (events && events.length > 0) {
              await setDoc(doc(db, userPath, 'googleAccounts', accountId), {
                id: accountId,
                email: newGoogleEmail,
                isAuthorized: true,
                syncType: 'ical',
                icalUrl: publicIcalUrl
              });
              toast.success("¡Sincronizado! Se ha detectado como calendario público.");
              setNewGoogleEmail('');
              return;
            }
          }
        } catch (e) {
          // Fallback to OAuth
        }

        await setDoc(doc(db, userPath, 'googleAccounts', accountId), {
          id: accountId,
          email: newGoogleEmail,
          isAuthorized: false,
          syncType: 'oauth'
        });
        toast.success("Cuenta añadida. Al ser privada, requiere una autorización única.");
      }
      setNewGoogleEmail('');
    } catch (e) {
      toast.error("Error al añadir la cuenta");
      handleFirestoreError(e, OperationType.WRITE, `${userPath}/googleAccounts/${accountId}`);
    }
  };

  const disconnectGoogleAccount = async (accountId: string) => {
    if (!user) return;
    try {
      const userPath = `users/${user.uid}`;
      await deleteDoc(doc(db, userPath, 'googleAccounts', accountId));
      toast.success("Cuenta desconectada");
    } catch (error) {
      console.error("Error disconnecting Google account:", error);
      toast.error("Error al desconectar la cuenta");
    }
  };

  const handleAddGoal = async (goalData: Omit<Goal, 'id' | 'progress' | 'status' | 'tasks'>) => {
    if (!user) return;
    const userPath = `users/${user.uid}`;
    const id = Math.random().toString(36).substr(2, 9);
    const newGoal: Goal = {
      id,
      progress: 0,
      status: 'active',
      tasks: [],
      ...goalData
    };
    try {
      await setDoc(doc(db, userPath, 'goals', id), newGoal);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `${userPath}/goals/${id}`);
    }
  };

  const handleAddTaskToGoal = async (goalId: string, taskData: { title: string; date?: string; time?: string; color?: string }) => {
    if (!user) return;
    const userPath = `users/${user.uid}`;
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    const newTask = {
      id: Math.random().toString(36).substr(2, 9),
      completed: false,
      ...taskData
    };
    const updatedTasks = [...goal.tasks, newTask];
    const goalEvents = events.filter(e => e.goalId === goal.id);
    const totalItems = updatedTasks.length + goalEvents.length;
    const completedItems = updatedTasks.filter(t => t.completed).length + goalEvents.filter(e => e.completed).length;
    const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    
    try {
      await updateDoc(doc(db, userPath, 'goals', goalId), { tasks: updatedTasks, progress });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `${userPath}/goals/${goalId}`);
    }
  };

  const toggleTaskCompletion = async (goalId: string, taskId: string) => {
    if (!user) return;
    const userPath = `users/${user.uid}`;
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    const updatedTasks = goal.tasks.map(task => 
      task.id === taskId ? { ...task, completed: !task.completed } : task
    );
    const goalEvents = events.filter(e => e.goalId === goal.id);
    const totalItems = updatedTasks.length + goalEvents.length;
    const completedItems = updatedTasks.filter(t => t.completed).length + goalEvents.filter(e => e.completed).length;
    const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    
    try {
      await updateDoc(doc(db, userPath, 'goals', goalId), { tasks: updatedTasks, progress });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `${userPath}/goals/${goalId}`);
    }
  };

  // Combine events and tasks for the calendar
  const getEventDateString = (start: string) => {
    if (!start) return '';
    try {
      if (start.includes('T')) {
        const date = parseISO(start);
        if (isNaN(date.getTime())) return '';
        return format(date, 'yyyy-MM-dd');
      }
      return start; // Already in YYYY-MM-DD format
    } catch (e) {
      return '';
    }
  };

  const holidayEvents: CalendarEvent[] = React.useMemo(() => {
    if (!showHolidays || !selectedCountry) return [];
    
    const years = [2024, 2025, 2026, 2027];
    const allHolidays: CalendarEvent[] = [];

    years.forEach(year => {
      // National Holidays
      if (NATIONAL_HOLIDAYS[selectedCountry]) {
        NATIONAL_HOLIDAYS[selectedCountry].forEach(h => {
          const [month, day] = h.date.split('-').map(Number);
          const dateStr = `${year}-${h.date}`;
          allHolidays.push({
            id: `holiday-nat-${year}-${h.date}`,
            title: h.name,
            start: dateStr,
            end: dateStr,
            color: theme === 'dark' ? '#FFFFFF' : '#000000',
            category: 'holiday'
          });
        });
      }

      // Regional Holidays (Spain only)
      if (selectedCountry === 'España' && selectedRegion && SPAIN_REGIONAL_HOLIDAYS[selectedRegion]) {
        SPAIN_REGIONAL_HOLIDAYS[selectedRegion].forEach(h => {
          const dateStr = `${year}-${h.date}`;
          allHolidays.push({
            id: `holiday-reg-${year}-${h.date}`,
            title: h.name,
            start: dateStr,
            end: dateStr,
            color: theme === 'dark' ? '#FFFFFF' : '#000000',
            category: 'holiday'
          });
        });
      }
    });

    return allHolidays;
  }, [showHolidays, selectedCountry, selectedRegion, theme]);

  const allEvents = React.useMemo(() => {
    const baseEvents = [
      ...events,
      ...googleEvents,
      ...holidayEvents,
    ].filter(e => e && e.start && typeof e.start === 'string');

    const taskEvents = goals.flatMap(goal => 
      (goal.tasks || [])
        .filter(task => task.date && task.time)
        .map(task => {
          try {
            // Ensure time is in HH:mm format (pad with zero if needed)
            let time = task.time || '00:00';
            if (time.length === 4 && time.includes(':')) {
              time = '0' + time;
            }
            
            const startStr = `${task.date}T${time}`;
            const startDate = new Date(startStr);
            
            if (isNaN(startDate.getTime())) return null;

            return {
              id: `task-${task.id}`,
              title: `Tarea: ${task.title}`,
              start: startDate.toISOString(),
              end: new Date(startDate.getTime() + 60 * 60 * 1000).toISOString(),
              color: task.color || goal.color,
              category: 'task'
            };
          } catch (e) {
            return null;
          }
        })
        .filter((e): e is CalendarEvent => e !== null)
    );

    return [...baseEvents, ...taskEvents];
  }, [events, googleEvents, holidayEvents, goals]);

  const calculateAlignmentScore = useCallback(() => {
    if (!perfectSchedule || Object.keys(perfectSchedule.slots).length === 0) return 0;

    const now = new Date();
    const threeMonthsAgo = subMonths(now, 3);
    const relevantEvents = allEvents.filter(e => {
      const date = new Date(e.start);
      return isWithinInterval(date, { start: threeMonthsAgo, end: now });
    });

    if (relevantEvents.length === 0) return 0;

    // Group by week
    const weeks: { [key: string]: CalendarEvent[] } = {};
    relevantEvents.forEach(e => {
      const weekStart = format(startOfWeek(new Date(e.start), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      if (!weeks[weekStart]) weeks[weekStart] = [];
      weeks[weekStart].push(e);
    });

    const weeklyScores: number[] = [];
    const perfectSlots = Object.keys(perfectSchedule.slots);
    
    Object.keys(weeks).forEach(weekStartStr => {
      const weekStart = parseISO(weekStartStr);
      let matches = 0;
      let totalSlots = perfectSlots.length;

      perfectSlots.forEach(slotKey => {
        const [dayIdx, hour] = slotKey.split('-').map(Number);
        const slot = perfectSchedule.slots[slotKey];
        
        // Find if there's an event in this week, on this day, at this hour
        const targetDate = addDays(weekStart, dayIdx);
        const eventInSlot = weeks[weekStartStr].find(e => {
          const eDate = new Date(e.start);
          return isSameDay(eDate, targetDate) && getHours(eDate) === hour;
        });

        if (eventInSlot) {
          if (slot.categoryId && eventInSlot.category === slot.categoryId) {
            matches++;
          } else if (slot.customText && eventInSlot.title.toLowerCase().includes(slot.customText.toLowerCase())) {
            matches++;
          }
        }
      });

      if (totalSlots > 0) {
        weeklyScores.push((matches / totalSlots) * 100);
      }
    });

    if (weeklyScores.length === 0) return 0;
    const average = weeklyScores.reduce((a, b) => a + b, 0) / weeklyScores.length;
    return Math.round(average);
  }, [perfectSchedule, allEvents]);

  useEffect(() => {
    // Check for Monday achievement
    if (isToday(new Date()) && getDay(new Date()) === 1) { // 1 is Monday
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      if (lastAlignmentAchievementRef.current !== todayStr) {
        const score = calculateAlignmentScore();
        if (score > 0) {
          const newAchievement: DayAchievement = {
            id: `alignment-${todayStr}`,
            date: todayStr,
            content: `Tu agenda de los últimos 3 meses coincide en un ${score}% con tu Horario Semanal Perfecto.`,
            createdAt: new Date().toISOString(),
            type: 'manual'
          };
          
          // Check if already exists
          if (!dayAchievements.find(a => a.id === newAchievement.id)) {
            const userPath = `users/${user?.uid}`;
            if (user) {
              setDoc(doc(db, userPath, 'achievements', newAchievement.id), newAchievement);
              lastAlignmentAchievementRef.current = todayStr;
            }
          }
        }
      }
    }
  }, [dayAchievements, calculateAlignmentScore, user]);

  const handleAddNote = async (noteData: Omit<Note, 'id' | 'createdAt'>) => {
    if (!user) return;
    const userPath = `users/${user.uid}`;
    const id = Math.random().toString(36).substr(2, 9);
    const newNote: Note = {
      id,
      createdAt: new Date().toISOString(),
      ...noteData
    };
    try {
      await setDoc(doc(db, userPath, 'notes', id), newNote);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `${userPath}/notes/${id}`);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!user) return;
    const userPath = `users/${user.uid}`;
    try {
      await deleteDoc(doc(db, userPath, 'notes', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `${userPath}/notes/${id}`);
    }
  };

  const handleAddHabit = async (habitData: Omit<Habit, 'id' | 'completedDates' | 'acquired' | 'streak'>) => {
    if (!user) return;
    const userPath = `users/${user.uid}`;
    const id = Math.random().toString(36).substr(2, 9);
    const newHabit: Habit = {
      id,
      completedDates: [],
      acquired: false,
      streak: 0,
      ...habitData
    };
    try {
      await setDoc(doc(db, userPath, 'habits', id), newHabit);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `${userPath}/habits/${id}`);
    }
  };

  const handleEditHabit = async (updatedHabit: Habit) => {
    if (!user) return;
    const userPath = `users/${user.uid}`;
    try {
      await setDoc(doc(db, userPath, 'habits', updatedHabit.id), updatedHabit);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `${userPath}/habits/${updatedHabit.id}`);
    }
  };

  const handleDeleteHabit = async (id: string) => {
    if (!user) return;
    const userPath = `users/${user.uid}`;
    try {
      await deleteDoc(doc(db, userPath, 'habits', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `${userPath}/habits/${id}`);
    }
  };

  const updateGoalProgress = async (id: string, progress: number) => {
    if (!user) return;
    const userPath = `users/${user.uid}`;
    try {
      await updateDoc(doc(db, userPath, 'goals', id), { progress });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `${userPath}/goals/${id}`);
    }
  };

  if (!isAuthReady) {
    return (
      <div className={cn(
        "h-screen flex items-center justify-center",
        theme === 'dark' ? "bg-black text-white" : "bg-[#f5f5f0] text-black"
      )}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#228B22]"></div>
      </div>
    );
  }

  if (!user) {
    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      
      const allowedUsers: { [key: string]: string } = {
        '003': 'PabloR*',
        '005': 'PabloR*',
        '401': 'GustavoG*',
        '402': 'CarlosS*'
      };

      if (!loginUser || !allowedUsers[loginUser]) {
        setLoginError('Usuario no válido');
        return;
      }

      if (loginPass !== allowedUsers[loginUser]) {
        setLoginError('Contraseña incorrecta');
        return;
      }
      
      setIsLoggingIn(true);
      setLoginError(null);
      try {
        // Use a dummy email for Firebase Auth based on the username
        await loginWithEmail(`${loginUser}@personal.agenda`, loginPass);
      } catch (error: any) {
        console.error("Login error:", error);
        if (error.code === 'auth/operation-not-allowed') {
          setLoginError('El inicio de sesión con usuario/contraseña no está habilitado en Firebase. Por favor, ve a la consola de Firebase > Authentication > Sign-in method y activa "Correo electrónico/contraseña".');
        } else if (error.code === 'auth/invalid-email') {
          setLoginError('Formato de usuario no válido.');
        } else if (error.code === 'auth/network-request-failed') {
          setLoginError('Error de red. Comprueba tu conexión.');
        } else if (error.code === 'auth/unauthorized-domain') {
          setLoginError('Dominio no autorizado. Debes añadir el dominio de Vercel a la lista de "Dominios autorizados" en la consola de Firebase (Authentication > Settings).');
        } else if (error.code === 'auth/invalid-credential') {
          setLoginError('Credenciales no válidas o el usuario no existe. Si es la primera vez, asegúrate de que el método de Correo/Contraseña esté activo en Firebase.');
        } else {
          setLoginError(error.message || `Error: ${error.code || 'desconocido'}. Inténtalo de nuevo.`);
        }
      } finally {
        setIsLoggingIn(false);
      }
    };

    return (
      <div className={cn(
        "h-screen flex flex-col items-center justify-center p-4",
        theme === 'dark' ? "bg-black text-white" : "bg-[#f5f5f0] text-black"
      )}>
        <Toaster position="top-center" richColors />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "w-full max-w-md p-8 rounded-[32px] border shadow-2xl text-center space-y-8",
            theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
          )}
        >
          <div className="flex justify-center">
            <div className="p-4 bg-[#228B22]/20 rounded-3xl">
              <LayoutDashboard className="w-12 h-12 text-[#228B22]" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tighter">planner_3pm</h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div className="space-y-1.5">
              <label className="text-[13px] font-black text-zinc-500 uppercase tracking-widest ml-1">Usuario</label>
              <input 
                type="text" 
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                placeholder="000"
                className={cn(
                  "w-full border rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#228B22]/50 text-sm",
                  theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-zinc-50 border-zinc-200 text-black"
                )}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-black text-zinc-500 uppercase tracking-widest ml-1">Contraseña de Acceso</label>
              <input 
                type="password" 
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                placeholder="••••••••"
                className={cn(
                  "w-full border rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#228B22]/50 text-sm",
                  theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-zinc-50 border-zinc-200 text-black"
                )}
              />
            </div>

            {loginError && (
              <p className="text-red-500 text-[15px] font-bold text-center">{loginError}</p>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className={cn(
                "w-full flex items-center justify-center gap-3 font-bold py-4 rounded-2xl shadow-xl active:scale-[0.98] transition-all",
                isLoggingIn ? "bg-zinc-500 cursor-not-allowed" : "bg-[#228B22] text-white hover:bg-[#1e7a1e]"
              )}
            >
              {isLoggingIn ? "Iniciando..." : "Entrar"}
            </button>
          </form>

          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <a 
              href="https://smileconsultores.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[13px] text-zinc-400 hover:text-[#228B22] transition-colors tracking-widest font-bold"
            >
              hand made by smileconsultores
            </a>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Toaster position="top-center" richColors />
      <div className={cn(
        "flex h-screen overflow-hidden font-sans transition-colors duration-300",
        theme === 'dark' ? "bg-black text-white" : "bg-[#f5f5f0] text-black"
      )}>
      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'calendar' && (
            <div key="calendar" className="h-full">
              <Calendar 
                events={allEvents} 
                goals={goals.filter(g => g.status === 'active')}
                habits={habits}
                onAddEvent={handleAddEvent} 
                onUpdateEvent={handleUpdateEvent}
                onDeleteEvent={handleDeleteEvent}
                onToggleHabitCompletion={toggleHabitCompletion}
                onToggleHabitAcquired={toggleHabitAcquired}
                onDayClosure={() => setShowDayClosure(true)}
                workDayStart={workDayStart}
                workDayEnd={workDayEnd}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                theme={theme}
                onShowTutorial={() => setShowTutorial(true)}
                perfectSchedule={perfectSchedule}
                categories={categories}
              />
            </div>
          )}
          {activeTab === 'goals' && (
            <div key="goals" className="h-full flex flex-col">
              <div className={cn(
                "flex items-center justify-between px-4 py-2 border-b",
                theme === 'dark' ? "border-zinc-900 bg-black" : "border-zinc-200 bg-[#f5f5f0]"
              )}>
                  <div className="flex items-center gap-2">
                    <h2 className={cn(
                      "text-xs font-bold capitalize",
                      theme === 'dark' ? "text-white" : "text-black"
                    )}>Metas</h2>
                  </div>
                  <div className={cn(
                    "flex items-center gap-1 p-1 rounded-xl",
                    theme === 'dark' ? "bg-zinc-900/50" : "bg-white/50"
                  )}>
                    {[
                      { id: 'calendar', icon: CalendarIcon },
                      { id: 'dashboard', icon: LayoutDashboard },
                      { id: 'goals', icon: Target },
                      { id: 'notes', icon: StickyNote },
                      { id: 'settings', icon: Settings },
                    ].map((item) => (
                      <button 
                        key={item.id}
                        onClick={() => setActiveTab(item.id as any)}
                        className={cn(
                          "p-1.5 rounded-lg transition-all", 
                          activeTab === item.id 
                            ? (theme === 'dark' ? "bg-zinc-800 text-white" : "bg-white text-black shadow-sm") 
                            : (theme === 'dark' ? "text-zinc-500" : "text-zinc-400")
                        )}
                      >
                        <item.icon className={cn(item.id === 'calendar' ? "w-6 h-6" : "w-[22px] h-[22px]")} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <Goals 
                    goals={goals} 
                    events={allEvents}
                    habits={habits}
                    onAddGoal={handleAddGoal} 
                    onAddTask={handleAddTaskToGoal}
                    onToggleTask={toggleTaskCompletion}
                    onToggleEvent={toggleEventCompletion}
                    onUpdateProgress={updateGoalProgress} 
                    onToggleHabit={toggleHabitCompletion}
                    onToggleHabitAcquired={toggleHabitAcquired}
                    onAddHabit={handleAddHabit}
                    onEditHabit={handleEditHabit}
                    onDeleteHabit={handleDeleteHabit}
                    theme={theme}
                    onShowTutorial={() => setShowTutorial(true)}
                  />
                </div>
              </div>
            )}
            {activeTab === 'notes' && (
              <div key="notes" className="h-full flex flex-col">
                <div className={cn(
                  "flex items-center justify-between px-4 py-2 border-b",
                  theme === 'dark' ? "border-zinc-900 bg-black" : "border-zinc-200 bg-[#f5f5f0]"
                )}>
                  <div className="flex items-center gap-2">
                    <h2 className={cn(
                      "text-xs font-bold capitalize",
                      theme === 'dark' ? "text-white" : "text-black"
                    )}>Notas</h2>
                  </div>
                  <div className={cn(
                    "flex items-center gap-1 p-1 rounded-xl",
                    theme === 'dark' ? "bg-zinc-900/50" : "bg-white/50"
                  )}>
                    {[
                      { id: 'calendar', icon: CalendarIcon },
                      { id: 'dashboard', icon: LayoutDashboard },
                      { id: 'goals', icon: Target },
                      { id: 'notes', icon: StickyNote },
                      { id: 'settings', icon: Settings },
                    ].map((item) => (
                      <button 
                        key={item.id}
                        onClick={() => setActiveTab(item.id as any)}
                        className={cn(
                          "p-1.5 rounded-lg transition-all", 
                          activeTab === item.id 
                            ? (theme === 'dark' ? "bg-zinc-800 text-white" : "bg-white text-black shadow-sm") 
                            : (theme === 'dark' ? "text-zinc-500" : "text-zinc-400")
                        )}
                      >
                        <item.icon className={cn(item.id === 'calendar' ? "w-6 h-6" : "w-[22px] h-[22px]")} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <Notes 
                    notes={notes} 
                    onAddNote={handleAddNote} 
                    onDeleteNote={handleDeleteNote} 
                    onConvertToEvent={(content) => {
                      handleAddEvent({
                        title: content,
                        start: new Date().toISOString(),
                        end: new Date(Date.now() + 3600000).toISOString(),
                        category: 'personal',
                        color: '#228B22'
                      });
                      setActiveTab('calendar');
                    }}
                    onConvertToGoal={(content) => {
                      handleAddGoal({
                        title: content,
                        description: 'Creado desde una nota',
                        category: 'personal',
                        targetDate: format(new Date(), 'yyyy-MM-dd'),
                        time: '09:00',
                        color: '#228B22'
                      });
                      setActiveTab('goals');
                    }}
                    onConvertToTask={(content) => {
                      if (goals.length > 0) {
                        handleAddTaskToGoal(goals[0].id, {
                          title: content,
                          date: format(new Date(), 'yyyy-MM-dd'),
                          color: goals[0].color
                        });
                        setActiveTab('goals');
                      } else {
                        // Create a goal first if none exists
                        const newGoalId = Math.random().toString(36).substr(2, 9);
                        const newGoal: Goal = {
                          id: newGoalId,
                          title: 'Inbox',
                          description: 'Tareas rápidas',
                          category: 'personal',
                          targetDate: format(new Date(), 'yyyy-MM-dd'),
                          time: '09:00',
                          color: '#228B22',
                          progress: 0,
                          status: 'active',
                          tasks: [{
                            id: Math.random().toString(36).substr(2, 9),
                            title: content,
                            completed: false,
                            date: format(new Date(), 'yyyy-MM-dd'),
                            color: '#228B22'
                          }]
                        };
                        setGoals([...goals, newGoal]);
                        setActiveTab('goals');
                      }
                    }}
                    theme={theme}
                  />
                </div>
              </div>
            )}
            {activeTab === 'settings' && (
              <div
                key="settings"
                className="h-full flex flex-col"
              >
                <div className={cn(
                  "flex items-center justify-between px-4 py-2 border-b",
                  theme === 'dark' ? "border-zinc-900 bg-black" : "border-zinc-200 bg-[#f5f5f0]"
                )}>
                  <div className="flex items-center gap-2">
                    <h2 className={cn(
                      "text-xs font-bold capitalize",
                      theme === 'dark' ? "text-white" : "text-black"
                    )}>Ajustes</h2>
                  </div>
                  <div className={cn(
                    "flex items-center gap-1 p-1 rounded-xl",
                    theme === 'dark' ? "bg-zinc-900/50" : "bg-white/50"
                  )}>
                    {[
                      { id: 'calendar', icon: CalendarIcon },
                      { id: 'dashboard', icon: LayoutDashboard },
                      { id: 'goals', icon: Target },
                      { id: 'notes', icon: StickyNote },
                      { id: 'settings', icon: Settings },
                    ].map((item) => (
                      <button 
                        key={item.id}
                        onClick={() => setActiveTab(item.id as any)}
                        className={cn(
                          "p-1.5 rounded-lg transition-all", 
                          activeTab === item.id 
                            ? (theme === 'dark' ? "bg-zinc-800 text-white" : "bg-white text-black shadow-sm") 
                            : (theme === 'dark' ? "text-zinc-500" : "text-zinc-400")
                        )}
                      >
                        <item.icon className={cn(item.id === 'calendar' ? "w-6 h-6" : "w-[22px] h-[22px]")} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 p-6 overflow-y-auto">
                  <div className="max-w-md mx-auto space-y-8">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="p-3 bg-[#228B22]/20 rounded-2xl">
                        <Settings className="w-6 h-6 text-[#228B22]" />
                      </div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-[21px] font-bold">Ajustes</h2>
                        <button 
                          onClick={() => setShowTutorial(true)}
                          className="p-1 text-yellow-500 hover:text-yellow-400 transition-colors"
                        >
                          <HelpCircle className="w-7 h-7" />
                        </button>
                      </div>
                    </div>

                    <div className={cn(
                      "rounded-3xl p-6 border space-y-6",
              theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm"
            )}>
                      <h3 className="text-[17px] font-black text-zinc-500 uppercase tracking-widest">Pantalla Predeterminada</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'dashboard', name: 'Inicio', icon: LayoutDashboard },
                          { id: 'calendar', name: 'Calendario', icon: CalendarIcon },
                          { id: 'goals', name: 'Metas', icon: Target },
                          { id: 'notes', name: 'Notas', icon: StickyNote },
                        ].map((screen) => (
                          <button
                            key={screen.id}
                            onClick={() => setDefaultTab(screen.id as any)}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-xl border transition-all",
                              defaultTab === screen.id
                                ? "bg-[#228B22] border-[#228B22] text-white"
                                : (theme === 'dark' ? "bg-zinc-800 border-zinc-700 text-zinc-400" : "bg-zinc-50 border-zinc-200 text-zinc-600")
                            )}
                          >
                            <screen.icon className="w-4 h-4" />
                            <span className="text-[15px] font-bold">{screen.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                  <div className={cn(
                    "rounded-3xl p-6 border space-y-4 cursor-pointer hover:border-[#228B22] transition-all",
                    theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm"
                  )}
                  onClick={() => setShowPerfectSchedule(true)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#228B22]/20 rounded-xl">
                          <Clock className="w-5 h-5 text-[#228B22]" />
                        </div>
                        <div>
                          <h3 className="text-[17px] font-bold">Horario Semanal Perfecto</h3>
                          <p className="text-[13px] text-zinc-500 uppercase tracking-widest font-black">Configura tu rutina ideal</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-bold text-[#228B22]">{calculateAlignmentScore()}%</span>
                        <ChevronRight className="w-4 h-4 text-zinc-500" />
                      </div>
                    </div>
                  </div>

                  <div className={cn(
                    "rounded-3xl p-6 border space-y-6",
                    theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm"
                  )}>
                    <h3 className="text-[17px] font-black text-zinc-500 uppercase tracking-widest">Apariencia</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-[17px] font-medium">Modo Claro</span>
                      <button 
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className={cn(
                          "w-12 h-6 rounded-full relative transition-colors duration-200",
                          theme === 'light' ? "bg-[#228B22]" : "bg-zinc-700"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200",
                          theme === 'light' ? "left-7" : "left-1"
                        )} />
                      </button>
                    </div>
                  </div>

                  <div className={cn(
                    "rounded-3xl p-6 border space-y-6",
                    theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm"
                  )}>
                    <h3 className="text-[17px] font-black text-zinc-500 uppercase tracking-widest">Jornada Laboral</h3>
                    
                    <div className="space-y-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-[15px] text-zinc-400">Hora de inicio ({workDayStart}:00)</label>
                        <input 
                          type="range" 
                          min="0" 
                          max="12" 
                          value={workDayStart}
                          onChange={(e) => setWorkDayStart(parseInt(e.target.value))}
                          className="w-full accent-[#228B22]"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-[15px] text-zinc-400">Hora de fin ({workDayEnd}:00)</label>
                        <input 
                          type="range" 
                          min="13" 
                          max="23" 
                          value={workDayEnd}
                          onChange={(e) => setWorkDayEnd(parseInt(e.target.value))}
                          className="w-full accent-[#228B22]"
                        />
                      </div>
                    </div>
                    
                    <p className="text-[13px] text-zinc-500 italic">
                      La vista diaria se ajustará para mostrar este rango de horas completo en pantalla.
                    </p>
                  </div>

                  <div className={cn(
                    "rounded-3xl p-6 border space-y-4",
                    theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm"
                  )}>
                    <h3 className="text-[17px] font-black text-zinc-500 uppercase tracking-widest">Aviso Fin de Jornada</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bell className={cn("w-[18px] h-[18px]", workEndNotify ? "text-[#228B22]" : "text-zinc-500")} />
                          <span className="text-[17px] font-medium">Activar aviso</span>
                        </div>
                        <button 
                          onClick={() => {
                            if (!workEndNotify && "Notification" in window) {
                              Notification.requestPermission();
                            }
                            setWorkEndNotify(!workEndNotify);
                          }}
                          className={cn(
                            "w-12 h-6 rounded-full relative transition-colors duration-200",
                            workEndNotify ? "bg-[#228B22]" : "bg-zinc-700"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200",
                            workEndNotify ? "left-7" : "left-1"
                          )} />
                        </button>
                      </div>

                      {workEndNotify && (
                        <div className="space-y-4 pt-2 border-t border-zinc-800/50">
                          <div className="space-y-2">
                            <label className="text-[16px] font-black text-zinc-500 uppercase tracking-widest">Hora del aviso</label>
                            <input 
                              type="time" 
                              value={workEndTime}
                              onChange={(e) => setWorkEndTime(e.target.value)}
                              className={cn(
                                "w-full border rounded-xl px-4 py-2 text-[17px] focus:outline-none",
                                theme === 'dark' ? "bg-zinc-800 border-zinc-700 text-white" : "bg-zinc-50 border-zinc-200 text-black"
                              )}
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[16px] font-black text-zinc-500 uppercase tracking-widest">Días de la semana</label>
                            <div className="flex justify-between gap-1">
                              {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((day, index) => (
                                <button
                                  key={index}
                                  onClick={() => {
                                    if (workEndDays.includes(index)) {
                                      setWorkEndDays(workEndDays.filter(d => d !== index));
                                    } else {
                                      setWorkEndDays([...workEndDays, index].sort());
                                    }
                                  }}
                                  className={cn(
                                    "w-8 h-8 rounded-lg text-[16px] font-bold transition-all",
                                    workEndDays.includes(index)
                                      ? "bg-[#228B22] text-white"
                                      : (theme === 'dark' ? "bg-zinc-800 text-zinc-500" : "bg-zinc-100 text-zinc-400")
                                  )}
                                >
                                  {day}
                                </button>
                              ))}
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button 
                                onClick={() => setWorkEndDays([1, 2, 3, 4, 5])}
                                className="text-[12px] font-bold text-[#228B22] uppercase tracking-tighter"
                              >
                                Laborables
                              </button>
                              <button 
                                onClick={() => setWorkEndDays([0, 1, 2, 3, 4, 5, 6])}
                                className="text-[12px] font-bold text-[#228B22] uppercase tracking-tighter"
                              >
                                Diario
                              </button>
                            </div>
                          </div>
                          
                          <button 
                            onClick={playPlink}
                            className="text-[16px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2 hover:text-white transition-colors"
                          >
                            <Bell className="w-3 h-3" />
                            Probar sonido (Plink!)
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={cn(
                    "rounded-3xl p-6 border space-y-4",
                    theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm"
                  )}>
                    <h3 className="text-[17px] font-black text-zinc-500 uppercase tracking-widest">Festivos</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[17px] font-medium">Mostrar Festivos</span>
                        <button 
                          onClick={() => setShowHolidays(!showHolidays)}
                          className={cn(
                            "w-12 h-6 rounded-full relative transition-colors duration-200",
                            showHolidays ? "bg-[#228B22]" : "bg-zinc-700"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200",
                            showHolidays ? "left-7" : "left-1"
                          )} />
                        </button>
                      </div>
                      
                      {showHolidays && (
                        <div className="space-y-4 pt-2 border-t border-zinc-800/50">
                          <div className="space-y-2">
                            <label className="text-[16px] font-black text-zinc-500 uppercase tracking-widest">País</label>
                            <select 
                              value={selectedCountry}
                              onChange={(e) => setSelectedCountry(e.target.value)}
                              className={cn(
                                "w-full border rounded-xl px-4 py-2 text-[17px] focus:outline-none",
                                theme === 'dark' ? "bg-zinc-800 border-zinc-700" : "bg-zinc-50 border-zinc-200"
                              )}
                            >
                              {Object.keys(NATIONAL_HOLIDAYS).map(country => (
                                <option key={country} value={country}>{country}</option>
                              ))}
                            </select>
                          </div>

                          {selectedCountry === 'España' && (
                            <div className="space-y-2">
                              <label className="text-[16px] font-black text-zinc-500 uppercase tracking-widest">Comunidad Autónoma</label>
                              <select 
                                value={selectedRegion}
                                onChange={(e) => setSelectedRegion(e.target.value)}
                                className={cn(
                                  "w-full border rounded-xl px-4 py-2 text-[17px] focus:outline-none",
                                  theme === 'dark' ? "bg-zinc-800 border-zinc-700" : "bg-zinc-50 border-zinc-200"
                                )}
                              >
                                <option value="">Seleccionar región...</option>
                                {Object.keys(SPAIN_REGIONAL_HOLIDAYS).map(region => (
                                  <option key={region} value={region}>{region}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={cn(
                    "rounded-3xl p-6 border space-y-4",
                    theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm"
                  )}>
                    <h3 className="text-[17px] font-black text-zinc-500 uppercase tracking-widest">Colores y Categorías</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Nombre de la categoría"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            className={cn(
                              "flex-1 border rounded-xl px-4 py-2 text-[17px] focus:outline-none focus:border-[#228B22]",
                              theme === 'dark' ? "bg-zinc-800 border-zinc-700" : "bg-zinc-50 border-zinc-200"
                            )}
                          />
                          <button 
                            onClick={() => {
                              if (newCategoryName) {
                                setCategories([...categories, { 
                                  id: Math.random().toString(36).substr(2, 9),
                                  name: newCategoryName, 
                                  color: newCategoryColor,
                                  description: newCategoryDescription
                                }]);
                                setNewCategoryName('');
                                setNewCategoryDescription('');
                              }
                            }}
                            className="bg-[#228B22] text-white p-2 rounded-xl active:scale-95 transition-all"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                        <textarea 
                          placeholder="Descripción de la categoría"
                          value={newCategoryDescription}
                          onChange={(e) => setNewCategoryDescription(e.target.value)}
                          rows={2}
                          className={cn(
                            "w-full border rounded-xl px-4 py-2 text-[17px] focus:outline-none focus:border-[#228B22] resize-none",
                            theme === 'dark' ? "bg-zinc-800 border-zinc-700" : "bg-zinc-50 border-zinc-200"
                          )}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {CLIENT_COLORS.map(color => (
                          <button
                            key={color}
                            onClick={() => setNewCategoryColor(color)}
                            className={cn(
                              "w-8 h-8 rounded-full border-2 transition-all",
                              newCategoryColor === color 
                                ? (theme === 'dark' ? "border-white scale-110" : "border-black scale-110") 
                                : "border-transparent"
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <div className="space-y-2 pt-2">
                        {categories.map((cat, index) => (
                          <div key={cat.id || index} className={cn(
                            "flex items-center justify-between p-3 rounded-xl border",
                            theme === 'dark' ? "bg-zinc-800/50 border-zinc-800" : "bg-zinc-50 border-zinc-100"
                          )}>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                                <span className="text-[17px] font-medium">{cat.name}</span>
                              </div>
                              {cat.description && (
                                <p className="text-[16px] text-zinc-500 mt-1 ml-6">{cat.description}</p>
                              )}
                            </div>
                            <button 
                              onClick={() => handleDeleteCategory(index)}
                              className="text-zinc-500 hover:text-rose-500 transition-colors"
                            >
                              <X className="w-[18px] h-[18px]" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className={cn(
                    "rounded-3xl p-6 border space-y-4",
                    theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm"
                  )}>
                      <h3 className="text-[17px] font-black text-zinc-500 uppercase tracking-widest">Calendarios Sincronizados</h3>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              value={newGoogleEmail}
                              onChange={(e) => setNewGoogleEmail(e.target.value)}
                              placeholder="Email o URL iCal (pública/secreta)"
                              className={cn(
                                "flex-1 border rounded-2xl px-4 py-3 text-[17px] focus:outline-none focus:ring-2 focus:ring-[#228B22]/50",
                                theme === 'dark' ? "bg-zinc-800 border-zinc-700 text-white" : "bg-zinc-50 border-zinc-200 text-black"
                              )}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddGoogleAccount()}
                            />
                            <button 
                              onClick={handleAddGoogleAccount}
                              className="bg-[#228B22] text-white p-3 rounded-2xl hover:bg-[#1a6b1a] transition-all active:scale-95"
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-[14px] font-black text-zinc-500 uppercase tracking-widest px-2">Cuentas Sincronizadas</h4>
                          {googleAccounts.length === 0 ? (
                            <p className="text-[15px] text-zinc-500 italic px-2">No hay cuentas sincronizadas todavía</p>
                          ) : (
                            googleAccounts.map((account) => (
                          <div 
                            key={account.id} 
                            className={cn(
                              "flex items-center justify-between p-4 rounded-2xl border",
                              theme === 'dark' ? "bg-zinc-800/50 border-zinc-800" : "bg-zinc-50 border-zinc-100"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-white",
                                account.isAuthorized ? "bg-[#ADD8E6]" : "bg-zinc-500"
                              )}>
                                <CalendarIcon className="w-4 h-4" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[17px] font-bold truncate max-w-[150px]">
                                  {account.syncType === 'ical' ? 'Calendario iCal' : account.email}
                                </span>
                                <span className="text-[16px] text-zinc-500 uppercase tracking-widest font-black">
                                  {account.syncType === 'ical' ? 'Sincronización Pública' : (account.isAuthorized ? 'Sincronizado' : 'Pendiente de conexión')}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {account.syncType === 'oauth' && !account.isAuthorized && (
                                <button 
                                  onClick={() => connectGoogleAccount(account.email)}
                                  className="text-[16px] font-black uppercase tracking-widest text-[#228B22] hover:bg-[#228B22]/10 px-3 py-1.5 rounded-lg transition-all"
                                >
                                  Conectar
                                </button>
                              )}
                              <button 
                                onClick={() => disconnectGoogleAccount(account.id)}
                                className="text-zinc-500 hover:text-rose-500 transition-colors p-2"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        )))}
                      </div>
                    </div>
                  </div>

                  <div className={cn(
                    "rounded-3xl p-6 border space-y-4",
                    theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm"
                  )}>
                    <h3 className="text-[17px] font-black text-zinc-500 uppercase tracking-widest">Datos</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={handleBackup}
                        className={cn(
                          "flex items-center justify-center gap-2 p-4 rounded-2xl text-[17px] font-bold transition-colors",
                          theme === 'dark' ? "bg-zinc-800 hover:bg-zinc-700" : "bg-zinc-100 hover:bg-zinc-200"
                        )}
                      >
                        <Download className="w-[18px] h-[18px]" />
                        Exportar
                      </button>
                      <label className={cn(
                        "flex items-center justify-center gap-2 p-4 rounded-2xl text-[17px] font-bold transition-colors cursor-pointer",
                        theme === 'dark' ? "bg-zinc-800 hover:bg-zinc-700" : "bg-zinc-100 hover:bg-zinc-200"
                      )}>
                        <Upload className="w-[18px] h-[18px]" />
                        Importar
                        <input type="file" className="hidden" onChange={handleRestore} accept=".json" />
                      </label>
                    </div>
                  </div>

                  {/* User Profile & Logout */}
                  <div className={cn(
                    "p-6 rounded-3xl border space-y-4",
                    theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm"
                  )}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-[#228B22] flex items-center justify-center text-white font-bold text-xl">
                        {user?.email?.startsWith('003') ? '003' : (user?.displayName?.[0] || user?.email?.[0])}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{user?.email?.startsWith('003') ? 'Usuario 003' : user?.displayName}</p>
                        <p className="text-[16px] text-zinc-500 truncate uppercase tracking-widest">Acceso Personal Privado</p>
                      </div>
                      <button 
                        onClick={() => logout()}
                        className={cn(
                          "p-2 rounded-xl transition-all active:scale-95",
                          theme === 'dark' ? "text-zinc-500 hover:text-white hover:bg-zinc-800" : "text-zinc-400 hover:text-black hover:bg-zinc-100"
                        )}
                        title="Cerrar sesión"
                      >
                        <LogOut className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
            {activeTab === 'dashboard' && (
              <div key="dashboard" className="h-full flex flex-col">
                <div className={cn(
                  "flex items-center justify-between px-4 py-2 border-b",
                  theme === 'dark' ? "border-zinc-900 bg-black" : "border-zinc-200 bg-[#f5f5f0]"
                )}>
                  <div className="flex items-center gap-2">
                    <h2 className={cn(
                      "text-[15px] font-bold capitalize",
                      theme === 'dark' ? "text-white" : "text-black"
                    )}>Inicio</h2>
                  </div>
                  <div className={cn(
                    "flex items-center gap-1 p-1 rounded-xl",
                    theme === 'dark' ? "bg-zinc-900/50" : "bg-white/50"
                  )}>
                    {[
                      { id: 'calendar', icon: CalendarIcon },
                      { id: 'dashboard', icon: LayoutDashboard },
                      { id: 'goals', icon: Target },
                      { id: 'notes', icon: StickyNote },
                      { id: 'settings', icon: Settings },
                    ].map((item) => (
                      <button 
                        key={item.id}
                        onClick={() => setActiveTab(item.id as any)}
                        className={cn(
                          "p-1.5 rounded-lg transition-all", 
                          activeTab === item.id 
                            ? (theme === 'dark' ? "bg-zinc-800 text-white" : "bg-white text-black shadow-sm") 
                            : (theme === 'dark' ? "text-zinc-500" : "text-zinc-400")
                        )}
                      >
                        <item.icon className={cn(item.id === 'calendar' ? "w-6 h-6" : "w-[22px] h-[22px]")} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 p-4 overflow-y-auto">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h2 className="text-[21px] font-bold">
                          {user?.email?.startsWith('402') ? 'Hola Carlos' : 'Hola Pablo'}
                        </h2>
                        <button 
                          onClick={() => setShowTutorial(true)}
                          className="p-1 text-yellow-500 hover:text-yellow-400 transition-colors"
                        >
                          <HelpCircle className="w-7 h-7" />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={handleBackup}
                          className={cn(
                            "p-2 border rounded-lg active:scale-95 transition-all",
                            theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-zinc-400" : "bg-white border-zinc-200 text-zinc-500 shadow-sm"
                          )}
                          title="Backup"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <label className={cn(
                          "p-2 border rounded-lg active:scale-95 transition-all cursor-pointer",
                          theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-zinc-400" : "bg-white border-zinc-200 text-zinc-500 shadow-sm"
                        )}>
                          <Upload className="w-4 h-4" />
                          <input type="file" className="hidden" onChange={handleRestore} accept=".json" />
                        </label>
                      </div>
                    </div>
                    
                    {/* Quick Stats */}
                    <div className={cn(
                      "p-5 rounded-2xl border shadow-xl",
                      theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                    )}>
                      <h3 className="font-bold text-zinc-500 mb-4 text-[15px] uppercase tracking-widest">Agenda de Hoy</h3>
                      <div className="space-y-4">
                        {allEvents
                          .filter(event => {
                            if (event.category === 'holiday') return false;
                            const eventDate = new Date(event.start);
                            return isToday(eventDate);
                          })
                          .slice(0, 5)
                          .map(event => (
                          <div key={event.id} className="flex gap-3 items-start">
                            <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: event.color }} />
                            <div>
                              <p className="text-[17px] font-semibold leading-tight">{event.title}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[16px] text-zinc-500">
                                  {format(new Date(event.start), 'HH:mm')} - {format(new Date(event.end), 'HH:mm')}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                        {allEvents.filter(e => e.category !== 'holiday' && isToday(new Date(e.start))).length === 0 && (
                          <p className="text-[15px] text-zinc-500 italic">No hay citas para hoy</p>
                        )}
                      </div>
                    </div>

                    <div className={cn(
                      "p-5 rounded-2xl border shadow-xl",
                      theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                    )}>
                      <h3 className="font-bold text-zinc-500 mb-4 text-[15px] uppercase tracking-widest">Metas Prioritarias</h3>
                      <div className="space-y-4">
                        {goals.slice(0, 2).map(goal => {
                          const goalEvents = events.filter(e => e.goalId === goal.id);
                          const totalItems = goal.tasks.length + goalEvents.length;
                          const completedItems = goal.tasks.filter(t => t.completed).length + goalEvents.filter(e => e.completed).length;
                          const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
                          
                          return (
                            <div key={goal.id} className="space-y-2">
                              <div className="flex justify-between text-[15px]">
                                <span className="font-medium truncate pr-2">{goal.title}</span>
                                <span className="text-emerald-400 font-bold">{Math.round(progress)}</span>
                              </div>
                              {goal.description && (
                                <p className="text-[16px] text-zinc-500 line-clamp-1">{goal.description}</p>
                              )}
                              <div className={cn(
                                "h-1.5 rounded-full overflow-hidden",
                                theme === 'dark' ? "bg-zinc-800" : "bg-zinc-100"
                              )}>
                                <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                              </div>
                            </div>
                          );
                        })}
                        {goals.length === 0 && (
                          <p className="text-[15px] text-zinc-500 italic">No hay metas activas</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
        </div>

          <AnimatePresence>
          {showPerfectSchedule && (
            <PerfectScheduleView 
              isOpen={showPerfectSchedule}
              onClose={() => setShowPerfectSchedule(false)}
              schedule={perfectSchedule}
              onSave={(newSchedule) => {
                setPerfectSchedule(newSchedule);
                setShowPerfectSchedule(false);
                toast.success("Horario semanal perfecto guardado");
              }}
              categories={categories}
              theme={theme}
              workDayStart={workDayStart}
              workDayEnd={workDayEnd}
            />
          )}
        </AnimatePresence>

        {/* Tutorial Modal */}
        <AnimatePresence>
          {showTutorial && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowTutorial(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className={cn(
                  "relative w-full max-w-lg rounded-3xl border p-6 shadow-2xl overflow-y-auto max-h-[80vh]",
                  theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                )}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <HelpCircle className="w-6 h-6 text-[#228B22]" />
                    Tutorial Rápido
                  </h3>
                  <button 
                    onClick={() => setShowTutorial(false)}
                    className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  <section className="space-y-2">
                    <h4 className="text-[17px] font-black text-[#228B22] uppercase tracking-widest">Inicio</h4>
                    <p className="text-[17px] text-zinc-400 leading-relaxed">
                      Vista general de tu día. Las <span className="text-white font-bold">Metas</span> se gestionan en su sección propia. Los <span className="text-white font-bold">Logros</span> se registran en el "Cierre del día" que aparece automáticamente al finalizar tu jornada laboral.
                    </p>
                  </section>

                  <section className="space-y-2">
                    <h4 className="text-[17px] font-black text-[#228B22] uppercase tracking-widest">Calendario</h4>
                    <p className="text-[17px] text-zinc-400 leading-relaxed">
                      Dispones de vistas de <span className="text-white font-bold">Día, Semana y Mes</span>. En dispositivos táctiles, desliza (swipe) <span className="text-white font-bold">arriba/abajo</span> para desplazarte en el tiempo y <span className="text-white font-bold">izquierda/derecha</span> para cambiar entre las vistas de día, semana y mes. En PC, utiliza el selector superior.
                    </p>
                    <p className="text-[17px] text-zinc-400 leading-relaxed">
                      Los <span className="text-white font-bold">Hábitos cumplidos</span> aparecen visualmente en los calendarios como pequeños puntos de color en la parte superior del día.
                    </p>
                  </section>

                  <section className="space-y-2">
                    <h4 className="text-[17px] font-black text-[#228B22] uppercase tracking-widest">Metas y Hábitos</h4>
                    <p className="text-[17px] text-zinc-400 leading-relaxed">
                      Añade metas con el botón <span className="text-white font-bold">+</span>. En esta sección también puedes gestionar tus <span className="text-white font-bold">Hábitos</span>: créalos con el botón <span className="text-white font-bold">+</span> y márcalos como <span className="text-white font-bold">Adquiridos</span> (icono de diana) cuando ya formen parte de tu rutina.
                    </p>
                  </section>

                  <section className="space-y-2">
                    <h4 className="text-[17px] font-black text-[#228B22] uppercase tracking-widest">Vista Diaria</h4>
                    <p className="text-[17px] text-zinc-400 leading-relaxed">
                      En la barra lateral derecha de la vista de día encontrarás dos iconos clave: <span className="text-white font-bold">Hábitos</span> (para registrar tus cumplimientos semanales) y <span className="text-white font-bold">Cierre del día</span> (para repasar tus logros y cerrar la jornada).
                    </p>
                  </section>

                  <section className="space-y-2">
                    <h4 className="text-[17px] font-black text-[#228B22] uppercase tracking-widest">Notas</h4>
                    <p className="text-[17px] text-zinc-400 leading-relaxed">
                      Graba notas de voz que se transcriben automáticamente a texto. Usa los botones debajo de cada nota para convertirlas rápidamente en <span className="text-white font-bold">Citas, Tareas o Metas</span>.
                    </p>
                  </section>

                  <section className="space-y-2">
                    <h4 className="text-[17px] font-black text-[#228B22] uppercase tracking-widest">Ajustes</h4>
                    <p className="text-[17px] text-zinc-400 leading-relaxed">
                      Personaliza tu experiencia: <span className="text-white font-bold">Horario laboral</span>, gestión de <span className="text-white font-bold">Festivos</span>, creación de <span className="text-white font-bold">Categorías</span> y opciones de <span className="text-white font-bold">Exportar/Importar</span> datos.
                    </p>
                  </section>

                  <section className="space-y-2">
                    <h4 className="text-[17px] font-black text-[#228B22] uppercase tracking-widest">Sincronización de Calendarios</h4>
                    <p className="text-[17px] text-zinc-400 leading-relaxed">
                      Para sincronizar tus calendarios de Google: ve a tu <span className="text-white font-bold">calendario de Google</span> &gt; <span className="text-white font-bold">Configuración</span> &gt; selecciona el calendario &gt; <span className="text-white font-bold">Integrar calendario</span> &gt; copia la <span className="text-white font-bold">Dirección secreta en formato iCal</span> y pégala en la sección de Ajustes en Calendarios Sincronizados.
                    </p>
                  </section>

                  <section className="space-y-2">
                    <h4 className="text-[17px] font-black text-[#228B22] uppercase tracking-widest">Horario Semanal Perfecto</h4>
                    <p className="text-[17px] text-zinc-400 leading-relaxed">
                      Diseña tu semana ideal en la sección de Ajustes. El sistema comparará tu agenda real de los últimos 3 meses con este horario para darte una <span className="text-white font-bold">puntuación de alineación</span>.
                    </p>
                    <p className="text-[17px] text-zinc-400 leading-relaxed">
                      Cada <span className="text-white font-bold">lunes</span>, esta puntuación se convertirá automáticamente en un <span className="text-white font-bold">Logro</span>, permitiéndote trackear visualmente qué tan fiel eres a tu planificación ideal a lo largo del tiempo.
                    </p>
                  </section>
                </div>

                <button 
                  onClick={() => setShowTutorial(false)}
                  className="w-full bg-[#228B22] text-white font-bold py-4 rounded-2xl shadow-xl active:scale-[0.98] transition-all mt-8"
                >
                  ¡Entendido!
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Day Closure Modal */}
          <AnimatePresence>
            {showDayClosure && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  className={cn(
                    "w-full max-w-lg rounded-[32px] p-8 shadow-2xl border relative",
                    theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                  )}
                >
                  <button 
                    onClick={() => setShowDayClosure(false)}
                    className="absolute top-6 right-6 p-2 rounded-full hover:bg-zinc-800/50 transition-colors"
                  >
                    <X className="w-5 h-5 text-zinc-500" />
                  </button>

                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-4 bg-[#228B22]/20 rounded-2xl">
                      <LayoutDashboard className="w-8 h-8 text-[#228B22]" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Cierre del Día</h2>
                      <p className="text-[17px] text-zinc-500">Repasemos lo que has conseguido hoy</p>
                    </div>
                  </div>

                  <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    {/* Items to check */}
                    <div className="space-y-3">
                      <h3 className="text-[15px] font-black text-zinc-500 uppercase tracking-widest">Citas y Tareas de Hoy</h3>
                      {allEvents
                        .filter(e => e.category !== 'holiday' && getEventDateString(e.start) === format(new Date(), 'yyyy-MM-dd'))
                        .map(item => (
                          <div 
                            key={item.id}
                            onClick={() => toggleEventCompletion(item.id)}
                            className={cn(
                              "flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all",
                              item.completed || (item.id.startsWith('task-') && goals.flatMap(g => g.tasks || []).find(t => t.id === item.id.replace('task-', ''))?.completed)
                                ? (theme === 'dark' ? "bg-emerald-500/10 border-emerald-500/30" : "bg-emerald-50 border-emerald-200")
                                : (theme === 'dark' ? "bg-zinc-800/50 border-zinc-800" : "bg-zinc-50 border-zinc-100")
                            )}
                          >
                            <div className={cn(
                              "w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all",
                              item.completed || (item.id.startsWith('task-') && goals.flatMap(g => g.tasks || []).find(t => t.id === item.id.replace('task-', ''))?.completed)
                                ? "bg-emerald-500 border-emerald-500"
                                : "border-zinc-500"
                            )}>
                              {(item.completed || (item.id.startsWith('task-') && goals.flatMap(g => g.tasks || []).find(t => t.id === item.id.replace('task-', ''))?.completed)) && <Plus className="w-3 h-3 text-white rotate-45" style={{ transform: 'rotate(0deg)' }} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className={cn(
                                "text-[17px] font-medium block truncate",
                                (item.completed || (item.id.startsWith('task-') && goals.flatMap(g => g.tasks || []).find(t => t.id === item.id.replace('task-', ''))?.completed)) && "line-through text-zinc-500"
                              )}>
                                {item.title}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>

                    {/* Habits section in Day Closure */}
                    <div className="space-y-3">
                      <h3 className="text-[15px] font-black text-zinc-500 uppercase tracking-widest">Hábitos de Hoy</h3>
                      <div className="grid grid-cols-1 gap-2">
                        {habits.map(habit => {
                          const todayStr = format(new Date(), 'yyyy-MM-dd');
                          const isCompleted = habit.completedDates.includes(todayStr);
                          return (
                            <div 
                              key={habit.id}
                              onClick={() => toggleHabitCompletion(habit.id)}
                              className={cn(
                                "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all",
                                isCompleted
                                  ? (theme === 'dark' ? "bg-blue-500/10 border-blue-500/30" : "bg-blue-50 border-blue-200")
                                  : (theme === 'dark' ? "bg-zinc-800/50 border-zinc-800" : "bg-zinc-50 border-zinc-100")
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                  isCompleted ? "bg-blue-500 border-blue-500" : "border-zinc-500"
                                )}>
                                  {isCompleted && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <span className={cn(
                                  "text-xs font-medium",
                                  isCompleted && "line-through text-zinc-500"
                                )}>{habit.title}</span>
                              </div>
                              {habit.acquired && <Target className="w-3 h-3 text-amber-500" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Achievements Input */}
                    <div className="space-y-3">
                      <h3 className="text-[15px] font-black text-zinc-500 uppercase tracking-widest">Logros del Día</h3>
                      
                      {/* Achievements List */}
                      <div 
                        className="max-h-40 overflow-y-auto pr-2 space-y-2 custom-scrollbar"
                        style={{ scrollBehavior: 'smooth' }}
                        ref={(el) => {
                          if (el) {
                            el.scrollTop = el.scrollHeight;
                          }
                        }}
                      >
                        {dayAchievements.filter(a => a.date === format(new Date(), 'yyyy-MM-dd')).length === 0 ? (
                          <p className="text-[13px] text-zinc-500 italic">No hay logros registrados hoy</p>
                        ) : (
                          dayAchievements
                            .filter(a => a.date === format(new Date(), 'yyyy-MM-dd'))
                            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                            .map(a => (
                              <div 
                                key={a.id}
                                className={cn(
                                  "p-3 rounded-xl border text-[15px] flex items-start gap-2",
                                  theme === 'dark' ? "bg-zinc-800/50 border-zinc-700 text-zinc-300" : "bg-zinc-50 border-zinc-200 text-zinc-600"
                                )}
                              >
                                <Target className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                                <p className="leading-relaxed">{a.content}</p>
                              </div>
                            ))
                        )}
                      </div>

                      <div className="relative">
                        <textarea 
                          id="achievement-input"
                          placeholder="¿Qué cosas te han gustado hoy? ¿Qué has conseguido?"
                          className={cn(
                            "w-full h-24 rounded-2xl p-4 text-[17px] border focus:outline-none focus:border-[#228B22] resize-none pr-12",
                            theme === 'dark' ? "bg-zinc-800 border-zinc-700 text-white" : "bg-zinc-50 border-zinc-200 text-black"
                          )}
                        />
                        <button 
                          onClick={() => {
                            const input = document.getElementById('achievement-input') as HTMLTextAreaElement;
                            const content = input.value.trim();
                            if (content) {
                              const newAchievement: DayAchievement = {
                                id: Math.random().toString(36).substr(2, 9),
                                date: format(new Date(), 'yyyy-MM-dd'),
                                content,
                                createdAt: new Date().toISOString()
                              };
                              setDayAchievements([...dayAchievements, newAchievement]);
                              input.value = '';
                            }
                          }}
                          className="absolute bottom-4 right-4 p-2 bg-[#228B22] text-white rounded-xl active:scale-95 transition-all"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-500 italic">Anota tus logros y pulsa el botón para guardarlos</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      // Add completed items as achievements
                      const todayStr = format(new Date(), 'yyyy-MM-dd');
                      
                      // 1. Completed Events and Tasks
                      const completedItems = allEvents.filter(e => 
                        e.category !== 'holiday' && 
                        getEventDateString(e.start) === todayStr && 
                        (e.completed || (e.id.startsWith('task-') && goals.flatMap(g => g.tasks).find(t => t.id === e.id.replace('task-', ''))?.completed))
                      );

                      const eventAchievements: DayAchievement[] = completedItems.map(item => ({
                        id: Math.random().toString(36).substr(2, 9),
                        date: todayStr,
                        content: item.title,
                        createdAt: new Date().toISOString(),
                        type: 'manual'
                      }));

                      // 2. Completed Habits
                      const completedHabits = habits.filter(h => h.completedDates.includes(todayStr));
                      const habitAchievements: DayAchievement[] = completedHabits.map(habit => ({
                        id: Math.random().toString(36).substr(2, 9),
                        date: todayStr,
                        content: habit.title,
                        createdAt: new Date().toISOString(),
                        type: 'habit'
                      }));

                      const allNewAchievements = [...eventAchievements, ...habitAchievements];

                      if (allNewAchievements.length > 0) {
                        setDayAchievements(prev => [...allNewAchievements, ...prev]);
                      }

                      setShowDayClosure(false);
                    }}
                    className="w-full mt-8 bg-[#228B22] text-white py-4 rounded-2xl font-bold active:scale-95 transition-all shadow-lg shadow-[#228B22]/20"
                  >
                    Finalizar Cierre
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </ErrorBoundary>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorInfo: string | null;
}

// Error Boundary Component
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState;
  public props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
    this.state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error instanceof Error ? error.message : String(error) };
  }

  render() {
    if (this.state.hasError) {
      let displayMessage = "Algo salió mal. Por favor, intenta recargar la página.";
      try {
        const parsed = JSON.parse(this.state.errorInfo || '{}');
        if (parsed.error && parsed.error.includes('Missing or insufficient permissions')) {
          displayMessage = "No tienes permisos para realizar esta acción o ver estos datos.";
        }
      } catch (e) {
        // Not JSON
      }

      return (
        <div className="h-screen flex flex-col items-center justify-center p-8 text-center space-y-4 bg-[#f5f5f0]">
          <div className="p-4 bg-red-100 rounded-full text-red-600">
            <AlertCircle className="w-12 h-12" />
          </div>
          <h1 className="text-2xl font-bold">Error de Aplicación</h1>
          <p className="text-zinc-600 max-w-md">{displayMessage}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-[#228B22] text-white font-bold rounded-2xl shadow-lg"
          >
            Recargar Aplicación
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function testConnection() {
  // Simple connection test
  getDocs(collection(db, 'test')).catch(() => {});
}
