import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  subDays,
  addWeeks,
  subWeeks,
  isSameWeek,
  parseISO,
  addMinutes,
  isToday,
  getDay,
  differenceInMinutes,
  startOfDay,
  differenceInCalendarDays
} from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  MapPin, 
  X,
  Calendar as CalendarIcon,
  HelpCircle,
  LayoutGrid,
  Columns,
  Square,
  LayoutDashboard,
  Target,
  StickyNote,
  Settings,
  ChevronDown,
  Key,
  Check,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence, useDragControls, DragControls } from 'motion/react';
import { cn, getContrastColor } from '../lib/utils';
import { CalendarEvent, Goal, Habit, PerfectSchedule, Category } from '../types';
import { CLIENT_COLORS } from '../constants';

interface CalendarProps {
  events: CalendarEvent[];
  goals?: Goal[];
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  onUpdateEvent?: (event: CalendarEvent) => void;
  onDeleteEvent?: (id: string) => void;
  workDayStart?: number;
  workDayEnd?: number;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  theme?: 'dark' | 'light';
  onShowTutorial?: () => void;
  habits?: Habit[];
  onToggleHabitCompletion?: (id: string, date?: string) => void;
  onToggleHabitAcquired?: (id: string) => void;
  onDayClosure?: () => void;
  perfectSchedule?: PerfectSchedule;
  categories?: Category[];
}

type ViewType = 'day' | 'week' | 'month';

export default function Calendar({ 
  events, 
  goals = [],
  onAddEvent, 
  onUpdateEvent, 
  onDeleteEvent,
  workDayStart = 7, 
  workDayEnd = 23,
  activeTab,
  setActiveTab,
  theme = 'dark',
  onShowTutorial,
  habits = [],
  onToggleHabitCompletion,
  onToggleHabitAcquired,
  onDayClosure,
  perfectSchedule,
  categories = []
}: CalendarProps) {
  const [view, setView] = useState<ViewType>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHabitsModalOpen, setIsHabitsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [direction, setDirection] = useState(0); // -1 for left, 1 for right
  const [directionY, setDirectionY] = useState(0); // -1 for up, 1 for down
  const dayViewContainerRef = React.useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formTime, setFormTime] = useState(format(new Date(), 'HH:mm'));
  const [formEndTime, setFormEndTime] = useState(format(addMinutes(new Date(), 60), 'HH:mm'));
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'>('daily');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(format(addMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]); // 0-6 for Sun-Sat
  const [isStartTimePickerOpen, setIsStartTimePickerOpen] = useState(false);
  const [isEndTimePickerOpen, setIsEndTimePickerOpen] = useState(false);
  const [formGoalId, setFormGoalId] = useState<string>('');
  const [formLocation, setFormLocation] = useState('');
  const [formColor, setFormColor] = useState(CLIENT_COLORS[0]);
  const [dragOffset, setDragOffset] = useState(0);
  const dragOffsetRef = React.useRef(0);
  const [resizingEvent, setResizingEvent] = useState<{ id: string, start?: string, end?: string } | null>(null);
  const resizingEventRef = React.useRef<{ id: string, start?: string, end?: string } | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<'none' | 'moving' | 'resizing-top' | 'resizing-bottom'>('none');
  const interactionModeRef = React.useRef<'none' | 'moving' | 'resizing-top' | 'resizing-bottom'>('none');
  const [lastClickTime, setLastClickTime] = useState(0);
  const longPressTimerRef = React.useRef<any>(null);
  const clickTimerRef = React.useRef<any>(null);
  const lastSnappedMinutesRef = React.useRef<number | null>(null);
  const [showDiscrepancyAlert, setShowDiscrepancyAlert] = useState(false);
  const [discrepancyMessage, setDiscrepancyMessage] = useState('');
  const [showGuideLine, setShowGuideLine] = useState(false);
  const guideInactivityTimerRef = React.useRef<any>(null);
  const inactivityTimerRef = React.useRef<any>(null);
  const startTimePickerTimerRef = React.useRef<any>(null);
  const endTimePickerTimerRef = React.useRef<any>(null);

  const startDeselectTimer = () => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(() => {
      setSelectedEventId(null);
      inactivityTimerRef.current = null;
    }, 10000); // 10 seconds
  };

  const startStartTimePickerTimer = () => {
    if (startTimePickerTimerRef.current) clearTimeout(startTimePickerTimerRef.current);
    startTimePickerTimerRef.current = setTimeout(() => {
      setIsStartTimePickerOpen(false);
      startTimePickerTimerRef.current = null;
    }, 5000); // 5 seconds
  };

  const startEndTimePickerTimer = () => {
    if (endTimePickerTimerRef.current) clearTimeout(endTimePickerTimerRef.current);
    endTimePickerTimerRef.current = setTimeout(() => {
      setIsEndTimePickerOpen(false);
      endTimePickerTimerRef.current = null;
    }, 5000); // 5 seconds
  };

  // Double check robustness
  if (!(currentDate instanceof Date) || isNaN(currentDate.getTime())) {
    return <div className="flex-1 flex items-center justify-center p-4">Error: Fecha inválida. Por favor, recarga la página.</div>;
  }

  const startHour = workDayStart ?? 7;
  const endHour = workDayEnd ?? 23;
  const totalHours = Math.max(1, endHour - startHour + 1);

  const setMode = (mode: 'none' | 'moving' | 'resizing-top' | 'resizing-bottom') => {
    setInteractionMode(mode);
    interactionModeRef.current = mode;
    if (mode !== 'none') {
      setShowGuideLine(true);
      resetGuideTimer();
    } else {
      setShowGuideLine(false);
      if (guideInactivityTimerRef.current) clearTimeout(guideInactivityTimerRef.current);
    }
  };

  const handlePointerUp = (cancelled: boolean = false) => {
    if (interactionModeRef.current !== 'none') {
      if (!cancelled && resizingEventRef.current && onUpdateEvent) {
        const event = events.find(ev => ev.id === resizingEventRef.current!.id);
        if (event) {
          const updatedEvent = {
            ...event,
            start: resizingEventRef.current!.start || event.start,
            end: resizingEventRef.current!.end || event.end
          };
          onUpdateEvent(updatedEvent);
        }
      }
      setMode('none');
      updateResizingEvent(null);
    }
  };

  const resetGuideTimer = () => {
    if (guideInactivityTimerRef.current) clearTimeout(guideInactivityTimerRef.current);
    guideInactivityTimerRef.current = setTimeout(() => {
      setShowGuideLine(false);
    }, 2500); // 2.5 seconds timeout
  };

  const updateResizingEvent = (data: { id: string, start?: string, end?: string } | null) => {
    setResizingEvent(data);
    resizingEventRef.current = data;
    if (data) resetGuideTimer();
  };

  // Global pointer listeners for precision interaction
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!dayViewContainerRef.current || !resizingEventRef.current || interactionModeRef.current === 'none') return;
      
      const container = dayViewContainerRef.current;
      const rect = container.getBoundingClientRect();
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const totalMinutes = totalHours * 60;
      
      // Calculate pointer position relative to the top of the scrollable content
      const pointerY = e.clientY - rect.top + scrollTop;
      
      const event = events.find(ev => ev.id === resizingEventRef.current?.id);
      if (!event) return;

      if (interactionModeRef.current === 'resizing-bottom') {
        const initialStart = parseISO(event.start);
        const minutesFromTop = (pointerY / scrollHeight) * totalMinutes;
        const snappedMinutes = Math.round(minutesFromTop / 15) * 15;
        
        const newEnd = new Date(currentDate);
        newEnd.setHours(startHour, snappedMinutes, 0, 0);
        
        // Minimum duration 15 mins
        if (newEnd.getTime() - initialStart.getTime() < 15 * 60 * 1000) return;
        // Maximum end time
        if (newEnd.getHours() > endHour + 1) return;

        if (snappedMinutes !== lastSnappedMinutesRef.current) {
          if (window.navigator.vibrate) window.navigator.vibrate(5);
          lastSnappedMinutesRef.current = snappedMinutes;
        }

        updateResizingEvent({ id: event.id, end: newEnd.toISOString() });
      } else if (interactionModeRef.current === 'resizing-top') {
        const initialEnd = parseISO(event.end);
        const minutesFromTop = (pointerY / scrollHeight) * totalMinutes;
        const snappedMinutes = Math.round(minutesFromTop / 15) * 15;
        
        const newStart = new Date(currentDate);
        newStart.setHours(startHour, snappedMinutes, 0, 0);
        
        // Minimum duration 15 mins
        if (initialEnd.getTime() - newStart.getTime() < 15 * 60 * 1000) return;
        // Minimum start time
        if (newStart.getHours() < startHour) return;

        if (snappedMinutes !== lastSnappedMinutesRef.current) {
          if (window.navigator.vibrate) window.navigator.vibrate(5);
          lastSnappedMinutesRef.current = snappedMinutes;
        }

        updateResizingEvent({ id: event.id, start: newStart.toISOString() });
      } else if (interactionModeRef.current === 'moving') {
        const minutesFromTop = ((pointerY - dragOffsetRef.current) / scrollHeight) * totalMinutes;
        const snappedMinutes = Math.round(minutesFromTop / 15) * 15;
        
        const newStart = new Date(currentDate);
        newStart.setHours(startHour, snappedMinutes, 0, 0);
        
        const duration = (parseISO(event.end).getTime() - parseISO(event.start).getTime());
        const newEnd = new Date(newStart.getTime() + duration);

        if (snappedMinutes !== lastSnappedMinutesRef.current) {
          if (window.navigator.vibrate) window.navigator.vibrate(5);
          lastSnappedMinutesRef.current = snappedMinutes;
        }

        updateResizingEvent({ id: event.id, start: newStart.toISOString(), end: newEnd.toISOString() });
      }
    };

    const onPointerUp = () => handlePointerUp(false);

    // Always add listeners to ensure responsiveness, but they early return if interactionMode is 'none'
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // Handle body styles based on interactionMode
    if (interactionMode !== 'none') {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (startTimePickerTimerRef.current) clearTimeout(startTimePickerTimerRef.current);
      if (endTimePickerTimerRef.current) clearTimeout(endTimePickerTimerRef.current);
    };
  }, [events, currentDate, handlePointerUp, interactionMode]); // interactionMode still needed for body styles

  // Handle clicks outside to deselect
  useEffect(() => {
    const handleClickOutside = (e: PointerEvent) => {
      if (selectedEventId && !(e.target as HTMLElement).closest('.calendar-event')) {
        setSelectedEventId(null);
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
          inactivityTimerRef.current = null;
        }
      }
    };
    window.addEventListener('pointerdown', handleClickOutside);
    return () => window.removeEventListener('pointerdown', handleClickOutside);
  }, [selectedEventId]);

  const handleSwipe = (offsetX: number, offsetY: number, velocityX: number, velocityY: number) => {
    const swipeThreshold = 20;
    const velocityThreshold = 150;
    
    const absX = Math.abs(offsetX);
    const absY = Math.abs(offsetY);
    const absVX = Math.abs(velocityX);
    const absVY = Math.abs(velocityY);

    // Axis detection: slightly more relaxed to catch natural swipes
    const isHorizontal = absX > absY || absVX > absVY;
    const isVertical = absY > absX || absVY > absVX;

    if (isHorizontal) {
      if (absX < swipeThreshold && absVX < velocityThreshold) return;

      if (offsetX > 0 || velocityX > velocityThreshold) { // Swipe Right -> Move to "left" view
        setDirection(-1);
        setDirectionY(0);
        if (view === 'month') setView('week');
        else if (view === 'week') setView('day');
        else if (view === 'day') setView('month');
      } else if (offsetX < 0 || velocityX < -velocityThreshold) { // Swipe Left -> Move to "right" view
        setDirection(1);
        setDirectionY(0);
        if (view === 'day') setView('week');
        else if (view === 'week') setView('month');
        else if (view === 'month') setView('day');
      }
    } else if (isVertical) {
      if (absY < swipeThreshold && absVY < velocityThreshold) return;

      if (offsetY > 0 || velocityY > velocityThreshold) { // Swipe Down -> Previous date
        setDirection(0);
        setDirectionY(-1);
        handlePrev();
      } else if (offsetY < 0 || velocityY < -velocityThreshold) { // Swipe Up -> Next date
        setDirection(0);
        setDirectionY(1);
        handleNext();
      }
    }
  };

  const handleNext = () => {
    if (view === 'month') setCurrentDate(prev => addMonths(prev, 1));
    else if (view === 'week') setCurrentDate(prev => addWeeks(prev, 1));
    else setCurrentDate(prev => addDays(prev, 1));
  };

  const handlePrev = () => {
    if (view === 'month') setCurrentDate(prev => subMonths(prev, 1));
    else if (view === 'week') setCurrentDate(prev => subWeeks(prev, 1));
    else setCurrentDate(prev => subDays(prev, 1));
  };

  const openEventModal = (date?: Date, time?: string, event?: CalendarEvent) => {
    if (event) {
      setEditingEventId(event.id);
      setFormTitle(event.title);
      const start = parseISO(event.start);
      const end = parseISO(event.end);
      setFormDate(format(start, 'yyyy-MM-dd'));
      setFormTime(format(start, 'HH:mm'));
      setFormEndTime(format(end, 'HH:mm'));
      setFormGoalId(event.goalId || '');
      setFormLocation(event.location || '');
      setFormColor(event.color);
      setIsRecurring(event.isRecurring || false);
      if (event.recurrence) {
        setRecurrenceFrequency(event.recurrence.frequency);
        setRecurrenceEndDate(format(parseISO(event.recurrence.endDate), 'yyyy-MM-dd'));
        setRecurrenceDays(event.recurrence.daysOfWeek || []);
      } else {
        setRecurrenceFrequency('daily');
        setRecurrenceEndDate(format(addMonths(new Date(), 1), 'yyyy-MM-dd'));
        setRecurrenceDays([]);
      }
    } else {
      setEditingEventId(null);
      setFormTitle('');
      setFormLocation('');
      setFormGoalId('');
      setFormColor(CLIENT_COLORS[0]);
      setIsRecurring(false);
      setRecurrenceFrequency('daily');
      setRecurrenceEndDate(format(addMonths(new Date(), 1), 'yyyy-MM-dd'));
      setRecurrenceDays([]);
      if (date) {
        setFormDate(format(date, 'yyyy-MM-dd'));
        setSelectedDate(date);
      }
      
      let initialTime = format(new Date(), 'HH:mm');
      if (time) {
        // Round to nearest 15 mins for new events
        const [h, m] = time.split(':').map(Number);
        const snappedMin = Math.round(m / 15) * 15;
        initialTime = `${h.toString().padStart(2, '0')}:${(snappedMin % 60).toString().padStart(2, '0')}`;
      } else {
        const now = new Date();
        const snappedMin = Math.round(now.getMinutes() / 15) * 15;
        now.setMinutes(snappedMin % 60);
        initialTime = format(now, 'HH:mm');
      }
      
      setFormTime(initialTime);
      const [h, m] = initialTime.split(':').map(Number);
      const endDate = new Date();
      endDate.setHours(h, m + 60);
      setFormEndTime(format(endDate, 'HH:mm'));
    }
    setIsModalOpen(true);
  };

  const handleSaveEvent = () => {
    console.log("handleSaveEvent called", { formTitle, formDate, formTime, formEndTime });
    if (!formTitle) {
      toast.error("El título es obligatorio");
      return;
    }

    // Ensure HH:mm format
    const [h, m] = formTime.split(':');
    const paddedStartTime = `${h.padStart(2, '0')}:${(m || '00').padStart(2, '0')}`;
    const [eh, em] = formEndTime.split(':');
    const paddedEndTime = `${eh.padStart(2, '0')}:${(em || '00').padStart(2, '0')}`;
    
    const startDateTime = new Date(`${formDate}T${paddedStartTime}`);
    const endDateTime = new Date(`${formDate}T${paddedEndTime}`);
    
    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      toast.error("Fecha o hora no válida");
      return;
    }

    if (endDateTime <= startDateTime) {
      toast.error("La hora de fin debe ser posterior a la de inicio");
      return;
    }

    try {
      // Check for discrepancy with Perfect Schedule
      if (perfectSchedule) {
        // getDay returns 0 for Sunday, 1 for Monday, etc.
        // PerfectSchedule uses 0 for Monday, 1 for Tuesday, ..., 6 for Sunday.
        const dayOfWeek = (getDay(startDateTime) + 6) % 7; 
        const hour = startDateTime.getHours();
        const slotKey = `${dayOfWeek}-${hour}`;
        const slot = perfectSchedule.slots[slotKey];
        
        if (slot) {
          let isDiscrepancy = false;
          let expectedCategoryName = '';

          if (slot.categoryId) {
            const category = categories.find(c => c.id === slot.categoryId);
            if (category) {
              expectedCategoryName = category.name;
              // If the event color doesn't match the category color, or if we want to be more specific
              // Here we check if the selected formColor matches the category color
              if (formColor !== category.color) {
                isDiscrepancy = true;
              }
            }
          } else if (slot.customText) {
            expectedCategoryName = slot.customText;
            // For custom text, we assume any event created here is a discrepancy if it doesn't match the title?
            // Or maybe just if it's not the "right" category color.
            // Let's stick to category color matching for now as it's the most reliable link.
            isDiscrepancy = true; 
          }

          if (isDiscrepancy) {
            setDiscrepancyMessage(`Esta franja está reservada para: ${expectedCategoryName}`);
            setShowDiscrepancyAlert(true);
            setTimeout(() => setShowDiscrepancyAlert(false), 4000);
          }
        }
      }

      const eventData: any = {
        title: formTitle,
        start: startDateTime.toISOString(),
        end: endDateTime.toISOString(),
        location: formLocation || '',
        color: formColor,
        category: 'event',
        isRecurring,
      };

      if (isRecurring) {
        eventData.recurrence = {
          frequency: recurrenceFrequency,
          endDate: new Date(`${recurrenceEndDate}T23:59:59`).toISOString(),
          daysOfWeek: recurrenceFrequency === 'weekly' ? recurrenceDays : undefined
        };
      }

      if (formGoalId) {
        eventData.goalId = formGoalId;
      }

      if (editingEventId && onUpdateEvent) {
        onUpdateEvent({
          id: editingEventId,
          ...eventData
        });
      } else {
        onAddEvent(eventData);
      }

      setIsModalOpen(false);
      setEditingEventId(null);
      setFormTitle('');
      setFormLocation('');
      setFormGoalId('');
      setIsRecurring(false);
    } catch (error) {
      console.error("Error saving event:", error);
      toast.error("Error al procesar la cita");
    }
  };

  const getEventDateString = (start: string) => {
    try {
      if (start.includes('T')) {
        const date = parseISO(start);
        if (isNaN(date.getTime())) return start;
        return format(date, 'yyyy-MM-dd');
      }
      return start; // Already in YYYY-MM-DD format
    } catch (e) {
      return start;
    }
  };

  const isEventOnDay = (event: CalendarEvent, day: Date) => {
    const eventStart = parseISO(event.start);
    const dayStart = startOfDay(day);
    const eventStartDate = startOfDay(eventStart);

    // If day is before event start, it can't occur
    if (dayStart < eventStartDate) return false;

    if (!event.isRecurring || !event.recurrence) {
      return isSameDay(dayStart, eventStartDate);
    }

    const recurrenceEnd = parseISO(event.recurrence.endDate);
    const recurrenceEndDate = startOfDay(recurrenceEnd);

    // If day is after recurrence end, it can't occur
    if (dayStart > recurrenceEndDate) return false;

    const diffDays = differenceInCalendarDays(dayStart, eventStartDate);

    switch (event.recurrence.frequency) {
      case 'daily':
        return true;
      case 'weekly':
        if (!event.recurrence.daysOfWeek || event.recurrence.daysOfWeek.length === 0) {
          return diffDays % 7 === 0;
        }
        return event.recurrence.daysOfWeek.includes(getDay(dayStart));
      case 'biweekly':
        return diffDays % 14 === 0;
      case 'monthly':
        const dayOfMonth = eventStartDate.getDate();
        const currentDayOfMonth = dayStart.getDate();
        const lastDayOfCurrentMonth = endOfMonth(dayStart).getDate();
        return currentDayOfMonth === dayOfMonth || (dayOfMonth > lastDayOfCurrentMonth && currentDayOfMonth === lastDayOfCurrentMonth);
      case 'yearly':
        return dayStart.getDate() === eventStartDate.getDate() && dayStart.getMonth() === eventStartDate.getMonth();
      default:
        return false;
    }
  };

  const getEventsForDay = (day: Date) => {
    return events.filter(event => isEventOnDay(event, day)).map(event => {
      // If it's recurring, we need to adjust the start and end dates to the current day for layout
      const originalStart = parseISO(event.start);
      if (event.isRecurring && !isSameDay(originalStart, day)) {
        const originalEnd = parseISO(event.end);
        const duration = originalEnd.getTime() - originalStart.getTime();
        
        const newStart = new Date(day);
        newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), originalStart.getSeconds(), originalStart.getMilliseconds());
        
        const newEnd = new Date(newStart.getTime() + duration);
        
        return {
          ...event,
          start: newStart.toISOString(),
          end: newEnd.toISOString()
        };
      }
      return event;
    });
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
    const rows = Math.ceil(calendarDays.length / 7);

    return (
      <div className="flex flex-col h-full">
        <div className={cn(
          "calendar-grid border-b shrink-0",
          theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-zinc-100 border-zinc-200"
        )}>
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(day => (
            <div key={day} className={cn(
              "py-1 text-center text-[16px] font-black uppercase",
              theme === 'dark' ? "text-white" : "text-zinc-600"
            )}>
              {day}
            </div>
          ))}
        </div>
        <div className={cn(
          "calendar-grid flex-1 h-full",
          theme === 'dark' ? "bg-black" : "bg-[#f5f5f0]"
        )} style={{ gridTemplateRows: `repeat(${rows}, 1fr)` }}>
          {calendarDays.map((day) => {
            const dayEvents = getEventsForDay(day);
            const holidays = dayEvents.filter(e => e.category === 'holiday');
            const regularEvents = dayEvents.filter(e => e.category !== 'holiday');
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={day.toString()}
                onClick={() => openEventModal(day)}
                className={cn(
                  "flex flex-col p-0.5 border-r border-b transition-colors overflow-hidden",
                  theme === 'dark' ? "border-zinc-900 active:bg-zinc-900" : "border-zinc-200 active:bg-zinc-200",
                  !isCurrentMonth && "opacity-20"
                )}
              >
                <div className="flex flex-wrap gap-0.5 justify-center overflow-hidden mb-0.5">
                  {(habits || []).filter(h => (h.completedDates || []).includes(format(day, 'yyyy-MM-dd'))).slice(0, 4).map(habit => (
                    <div 
                      key={habit.id}
                      title={habit.title}
                      className={cn(
                        "w-1.5 h-1.5 rounded-full shadow-sm",
                        habit.category === 'professional' ? "bg-blue-500" : "bg-[#228B22]"
                      )}
                    />
                  ))}
                </div>
                <div className="flex justify-center items-center mb-0.5 relative">
                  <span className={cn(
                    "text-[14px] font-bold w-5 h-5 flex items-center justify-center rounded-full",
                    isToday && "bg-[#228B22] text-white",
                    !isToday && isCurrentMonth && (theme === 'dark' ? "text-zinc-200" : "text-zinc-700")
                  )}>
                    {format(day, 'd')}
                  </span>
                  {holidays.length > 0 && (
                    <div 
                      className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full border border-zinc-800 shadow-sm"
                      style={{ backgroundColor: theme === 'dark' ? '#FFFFFF' : '#000000' }}
                      title={holidays.map(h => h.title).join(', ')}
                    />
                  )}
                </div>
                <div className="flex flex-wrap gap-0.5 justify-center overflow-hidden">
                  {regularEvents.slice(0, 4).map(event => (
                    <div 
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEventModal(undefined, undefined, event);
                      }}
                      className="w-2 h-2 rounded-full cursor-pointer hover:scale-110 transition-transform"
                      style={{ backgroundColor: event.color }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({
      start: startDate,
      end: addDays(startDate, 6)
    });

    // Helper for mini month in the 8th box
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const monthDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return (
      <div className={cn(
        "flex-1 p-1 overflow-hidden",
        theme === 'dark' ? "bg-black" : "bg-[#f5f5f0]"
      )}>
        <div className="grid grid-cols-2 grid-rows-4 gap-1 h-full max-h-full">
          {/* 7 Days Boxes */}
          {weekDays.map((day) => {
            const dayEvents = getEventsForDay(day)
              .sort((a, b) => (a.start || "").localeCompare(b.start || ""));
            
            const holidays = dayEvents.filter(e => e.category === 'holiday');
            const regularEvents = dayEvents.filter(e => e.category !== 'holiday');

            return (
              <div 
                key={day.toString()} 
                onClick={() => openEventModal(day)}
                className={cn(
                  "rounded-xl p-2 border flex flex-col overflow-hidden transition-all h-full",
                  theme === 'dark' 
                    ? (holidays.length > 0 ? "bg-[#228B22]/10 border-[#228B22]/30" : "bg-zinc-950 border-zinc-900") 
                    : (holidays.length > 0 ? "bg-[#228B22]/5 border-[#228B22]/20" : "bg-white border-zinc-200 shadow-sm")
                )}
              >
                <div className={cn(
                  "flex items-baseline gap-1 mb-1 border-b pb-0.5",
                  theme === 'dark' ? "border-zinc-900" : "border-zinc-100"
                )}>
                  <span className={cn(
                    "text-[18px] font-black lowercase truncate",
                    theme === 'dark' ? "text-white" : "text-zinc-800"
                  )}>
                    {format(day, 'eeee', { locale: es }).toLowerCase()}
                  </span>
                  <span className={cn(
                    "text-[18px] font-black shrink-0",
                    isSameDay(day, new Date()) ? "text-[#228B22]" : (theme === 'dark' ? "text-zinc-300" : "text-zinc-600")
                  )}>
                    {format(day, 'd')}
                  </span>
                  {holidays.length > 0 && (
                    <div 
                      className="w-3 h-3 rounded-full border border-zinc-800 shadow-sm shrink-0"
                      style={{ backgroundColor: theme === 'dark' ? '#FFFFFF' : '#000000' }}
                      title={holidays.map(h => h.title).join(', ')}
                    />
                  )}
                </div>
                
                <div className="flex-1 space-y-1 overflow-y-auto scrollbar-hide">
                  {holidays.length > 0 && (
                    <div className={cn(
                      "mb-2 p-1.5 rounded-lg border",
                      theme === 'dark' ? "bg-[#228B22]/10 border-[#228B22]/20" : "bg-[#228B22]/5 border-[#228B22]/10"
                    )}>
                      {holidays.map(h => (
                        <p key={h.id} className="text-[15px] font-black uppercase tracking-tighter text-[#228B22] italic truncate flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-[#228B22]" />
                          {h.title}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Habits in Week View */}
                  {(habits || []).filter(h => (h.completedDates || []).includes(format(day, 'yyyy-MM-dd'))).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(habits || []).filter(h => (h.completedDates || []).includes(format(day, 'yyyy-MM-dd'))).map(habit => (
                        <div 
                          key={habit.id}
                          title={habit.title}
                          className={cn(
                            "w-2.5 h-2.5 rounded-full shadow-sm",
                            habit.category === 'professional' ? "bg-blue-500" : "bg-[#228B22]"
                          )}
                        />
                      ))}
                    </div>
                  )}

                  {regularEvents.length > 0 ? (
                    regularEvents.map(event => (
                      <div 
                        key={event.id} 
                        onClick={(e) => {
                          e.stopPropagation();
                          openEventModal(undefined, undefined, event);
                        }}
                        className="flex items-center gap-1.5 text-[18px] cursor-pointer hover:bg-white/5 rounded px-1 transition-colors"
                      >
                        <span className={cn(
                          "font-medium whitespace-nowrap",
                          theme === 'dark' ? "text-white" : "text-zinc-900"
                        )}>
                          {format(parseISO(event.start), 'HH:mm')}
                        </span>
                        <div 
                          className="w-2.5 h-2.5 rounded-full shrink-0" 
                          style={{ backgroundColor: event.color }}
                        />
                        <span className={cn(
                          "truncate font-medium",
                          theme === 'dark' ? "text-zinc-200" : "text-zinc-700"
                        )}>
                          {event.title}
                        </span>
                      </div>
                    ))
                  ) : holidays.length === 0 && (
                    <div className="h-full flex items-center justify-center opacity-5">
                      <Plus className={cn("w-3 h-3", theme === 'dark' ? "text-white" : "text-black")} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* 8th Box: Month View */}
          <div className={cn(
            "rounded-xl p-2 border flex flex-col overflow-hidden",
            theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-zinc-200 shadow-sm"
          )}>
            <div className={cn(
              "text-[18px] font-bold lowercase mb-1 border-b pb-0.5 text-center",
              theme === 'dark' ? "text-zinc-500 border-zinc-900" : "text-zinc-400 border-zinc-100"
            )}>
              {format(currentDate, 'MMM', { locale: es }).toLowerCase()}
            </div>
            <div className="grid grid-cols-7 gap-0.5 flex-1 content-center">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
                <div key={d} className="text-[14px] text-zinc-600 font-bold text-center">{d}</div>
              ))}
              {monthDays.map((day, idx) => {
                const isCurrentWeek = isSameWeek(day, currentDate, { weekStartsOn: 1 });
                const isCurrentMonth = isSameMonth(day, monthStart);
                
                return (
                  <div 
                    key={idx}
                    className={cn(
                      "text-[14px] flex items-center justify-center rounded-sm h-3",
                      isCurrentWeek && "bg-[#228B22] text-white",
                      !isCurrentMonth && "opacity-10",
                      !isCurrentWeek && isCurrentMonth && (theme === 'dark' ? "text-zinc-400" : "text-zinc-600")
                    )}
                  >
                    {format(day, 'd')}
                    <div className="absolute -bottom-0.5 left-0 right-0 flex justify-center gap-0.5">
                      {(habits || []).filter(h => (h.completedDates || []).includes(format(day, 'yyyy-MM-dd'))).slice(0, 3).map(habit => (
                        <div 
                          key={habit.id}
                          className={cn(
                            "w-1 h-1 rounded-full",
                            habit.category === 'professional' ? "bg-blue-500" : "bg-[#228B22]"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const hours = Array.from({ length: totalHours }, (_, i) => startHour + i);
    const dayEvents = getEventsForDay(currentDate);
    const holidays = dayEvents.filter(e => e.category === 'holiday');
    const regularEvents = dayEvents.filter(e => e.category !== 'holiday');

    // Calculate layout for overlapping events
    const getLayouts = () => {
      const sorted = [...regularEvents].sort((a, b) => {
        const startA = resizingEvent?.id === a.id && resizingEvent.start ? parseISO(resizingEvent.start).getTime() : parseISO(a.start).getTime();
        const startB = resizingEvent?.id === b.id && resizingEvent.start ? parseISO(resizingEvent.start).getTime() : parseISO(b.start).getTime();
        return startA - startB;
      });
      
      const clusters: CalendarEvent[][] = [];
      let currentCluster: CalendarEvent[] = [];
      let clusterEnd = 0;

      sorted.forEach(event => {
        const start = resizingEvent?.id === event.id && resizingEvent.start ? parseISO(resizingEvent.start).getTime() : parseISO(event.start).getTime();
        const end = resizingEvent?.id === event.id && resizingEvent.end ? parseISO(resizingEvent.end).getTime() : parseISO(event.end).getTime();

        if (start >= clusterEnd) {
          if (currentCluster.length > 0) clusters.push(currentCluster);
          currentCluster = [event];
          clusterEnd = end;
        } else {
          currentCluster.push(event);
          clusterEnd = Math.max(clusterEnd, end);
        }
      });
      if (currentCluster.length > 0) clusters.push(currentCluster);

      const layouts: Record<string, { left: number; width: number }> = {};
      clusters.forEach(cluster => {
        const columns: CalendarEvent[][] = [];
        cluster.forEach(event => {
          let placed = false;
          const eventStart = resizingEvent?.id === event.id && resizingEvent.start ? parseISO(resizingEvent.start).getTime() : parseISO(event.start).getTime();
          for (let i = 0; i < columns.length; i++) {
            const lastEvent = columns[i][columns[i].length - 1];
            const lastEventEnd = resizingEvent?.id === lastEvent.id && resizingEvent.end ? parseISO(resizingEvent.end).getTime() : parseISO(lastEvent.end).getTime();
            if (eventStart >= lastEventEnd) {
              columns[i].push(event);
              placed = true;
              break;
            }
          }
          if (!placed) columns.push([event]);
        });

        const numCols = columns.length;
        columns.forEach((col, i) => {
          col.forEach(event => {
            layouts[event.id] = {
              left: (i / numCols) * 100,
              width: (1 / numCols) * 100
            };
          });
        });
      });
      return layouts;
    };

    const layouts = getLayouts();

  const handleInteractionStart = (event: CalendarEvent, mode: 'moving' | 'resizing-top' | 'resizing-bottom', pointerY: number) => {
    if (!dayViewContainerRef.current) return;
    const container = dayViewContainerRef.current;
    const rect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const totalMinutes = totalHours * 60;
    
    if (mode === 'moving') {
      const start = parseISO(event.start);
      const eventHour = start.getHours();
      const eventMinutes = start.getMinutes();
      const hourIndex = eventHour - startHour;
      const eventTop = (hourIndex + eventMinutes / 60) * (scrollHeight / totalHours);
      dragOffsetRef.current = (pointerY - rect.top + scrollTop) - eventTop;
    }
    
    // Reset snapped minutes tracker
    lastSnappedMinutesRef.current = null;
    
    setMode(mode);
    updateResizingEvent({ id: event.id });
    if (window.navigator.vibrate) window.navigator.vibrate(20);
  };

    return (
      <div className={cn(
        "flex h-full overflow-hidden",
        theme === 'dark' ? "bg-black" : "bg-[#f5f5f0]"
      )}>
        <div className="flex-1 flex flex-col px-2 py-1">
          {holidays.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {holidays.map(h => (
                <div key={h.id} className={cn(
                  "px-4 py-2 rounded-2xl border flex items-center gap-3",
                  theme === 'dark' ? "bg-[#228B22]/20 border-[#228B22]/40" : "bg-[#228B22]/10 border-[#228B22]/20 shadow-sm"
                )}>
                  <div 
                    className="w-3 h-3 rounded-full border border-zinc-800 shadow-sm shrink-0"
                    style={{ backgroundColor: theme === 'dark' ? '#FFFFFF' : '#000000' }}
                  />
                  <div className="flex flex-col">
                    <span className="text-[16px] font-black uppercase tracking-widest text-[#228B22] italic leading-none mb-0.5">
                      Festivo
                    </span>
                    <span className={cn(
                      "text-sm font-bold",
                      theme === 'dark' ? "text-white" : "text-zinc-900"
                    )}>
                      {h.title}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Habits in Day View - REMOVED per user request as they are on home page */}
          <div 
            className={cn(
              "flex-1 relative overflow-hidden", // Changed overflow-y-auto to overflow-hidden
              interactionMode !== 'none' && "touch-none"
            )} 
            ref={dayViewContainerRef} 
            onClick={() => setSelectedEventId(null)}
          >
            <div className="flex flex-col h-full relative" style={{ minHeight: `${totalHours * 40}px` }}>
              {hours.map((hour) => (
                <div 
                  key={hour} 
                  className={cn(
                    "flex-1 border-b flex items-start gap-1 relative",
                    theme === 'dark' ? "border-zinc-900/50" : "border-zinc-200/50"
                  )}
                  onClick={() => openEventModal(currentDate, `${hour.toString().padStart(2, '0')}:00`)}
                >
                  <span className={cn(
                    "text-[12px] w-7 font-mono -translate-y-1/2 shrink-0 text-center",
                    theme === 'dark' ? "text-white/60" : "text-zinc-400"
                  )}>{hour.toString().padStart(2, '0')}:00</span>
                  <div className="flex-1 h-full" />
                </div>
              ))}

      {/* Visual Guide Line */}
      <AnimatePresence>
        {showGuideLine && resizingEvent && (
          <motion.div 
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0, scaleX: 0 }}
            className="absolute left-0 right-0 border-t-2 border-dashed border-primary/50 z-[110] pointer-events-none flex items-center justify-start"
            style={{ 
              top: (() => {
                const event = events.find(e => e.id === resizingEvent.id);
                if (!event) return '0%';
                
                const timeStr = (interactionMode === 'resizing-bottom') 
                  ? (resizingEvent.end || event.end)
                  : (resizingEvent.start || event.start);
                
                try {
                  const date = parseISO(timeStr);
                  if (isNaN(date.getTime())) return '0%';
                  const baseDate = startOfDay(currentDate);
                  baseDate.setHours(startHour, 0, 0, 0);
                  const diff = differenceInMinutes(date, baseDate);
                  return `${(diff / (totalHours * 60)) * 100}%`;
                } catch(e) {
                  return '0%';
                }
              })()
            }}
          >
            <span className="bg-primary text-primary-foreground text-[16px] w-12 py-1 rounded-r-lg shadow-lg font-bold -translate-y-1/2 flex items-center justify-center">
              {(() => {
                const event = events.find(e => e.id === resizingEvent.id);
                if (!event) return '--:--';
                const timeStr = (interactionMode === 'resizing-bottom') 
                  ? (resizingEvent.end || event.end)
                  : (resizingEvent.start || event.start);
                try {
                  const date = parseISO(timeStr);
                  return isNaN(date.getTime()) ? '--:--' : format(date, 'HH:mm');
                } catch(e) {
                  return '--:--';
                }
              })()}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

        {regularEvents.map(event => {
            const isResizing = resizingEvent?.id === event.id;
            const start = isResizing && resizingEvent.start ? parseISO(resizingEvent.start) : parseISO(event.start);
            const end = isResizing && resizingEvent.end ? parseISO(resizingEvent.end) : parseISO(event.end);
            const eventHour = start.getHours();
            const eventMinutes = start.getMinutes();
            
            // Only show if within work hours
            if (eventHour < startHour || eventHour > endHour) return null;

            const hourIndex = eventHour - startHour;
            const topPercent = (hourIndex + eventMinutes / 60) * (100 / totalHours);
            
            // Calculate height based on duration
            const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
            const heightPercent = (durationMinutes / 60) * (100 / totalHours);
            const isSelected = selectedEventId === event.id;

              const contrastColor = getContrastColor(event.color);
              const textColorClass = contrastColor === 'black' ? 'text-black' : 'text-white';
              const secondaryTextColorClass = contrastColor === 'black' ? 'text-black/70' : 'text-white/80';

              const layout = layouts[event.id] || { left: 0, width: 100 };

              return (
                <EventComponent 
                  key={event.id}
                  event={event}
                  isSelected={isSelected}
                  topPercent={topPercent}
                  heightPercent={heightPercent}
                  leftPercent={layout.left}
                  widthPercent={layout.width}
                  textColorClass={textColorClass}
                  secondaryTextColorClass={secondaryTextColorClass}
                  handleInteractionStart={handleInteractionStart}
                  startDeselectTimer={startDeselectTimer}
                  interactionMode={interactionMode}
                  resizingEvent={resizingEvent}
                  selectedEventId={selectedEventId}
                  setSelectedEventId={setSelectedEventId}
                  setMode={setMode}
                  setResizingEvent={setResizingEvent}
                  openEventModal={openEventModal}
                  lastClickTime={lastClickTime}
                  setLastClickTime={setLastClickTime}
                  longPressTimerRef={longPressTimerRef}
                  clickTimerRef={clickTimerRef}
                  theme={theme}
                />
              );
          })}
            </div>
          </div>
        </div>

        {/* Right Sidebar for Date */}
        <div className={cn(
          "w-20 border-l flex flex-col items-center py-4 px-2 text-center relative overflow-hidden",
          theme === 'dark' ? "border-zinc-900 bg-zinc-950" : "border-zinc-200 bg-white"
        )}>
            {/* Habit Dots at the top (Vertical) */}
            <div className="flex flex-col gap-1 mb-2">
              {(habits || []).filter(h => (h.completedDates || []).includes(format(currentDate, 'yyyy-MM-dd'))).slice(0, 6).map(habit => (
                <div 
                  key={habit.id}
                  title={habit.title}
                  className={cn(
                    "w-2.5 h-2.5 rounded-full shadow-sm border border-black/10",
                    habit.category === 'professional' ? "bg-blue-500" : "bg-[#228B22]"
                  )}
                />
              ))}
            </div>
          
          <div className="flex-1" />

          {/* Centered Date */}
          <div className="flex flex-col items-center gap-0.5">
            <span className={cn(
              "text-[16px] font-bold lowercase tracking-tighter",
              theme === 'dark' ? "text-white" : "text-zinc-800"
            )}>
              {format(currentDate, "EEEE", { locale: es }).toLowerCase()}
            </span>
            <span 
              className="text-4xl font-black leading-none my-0.5"
              style={{ 
                color: isToday(currentDate) 
                  ? '#228B22' 
                  : getDay(currentDate) === 0 
                    ? '#ef4444' 
                    : '#f97316' 
              }}
            >
              {format(currentDate, "d")}
            </span>
            <span className={cn(
              "text-[18px] font-bold lowercase",
              theme === 'dark' ? "text-white" : "text-zinc-800"
            )}>
              {format(currentDate, "MMMM", { locale: es }).toLowerCase()}
            </span>
            <span className={cn(
              "text-[15px] font-medium",
              theme === 'dark' ? "text-white/60" : "text-zinc-400"
            )}>
              {format(currentDate, "yyyy")}
            </span>
          </div>

          <div className="flex-1" />

          {/* Icons in lower half */}
          <div className="flex flex-col gap-3 mb-12">
            <button 
              onClick={() => setIsHabitsModalOpen(true)}
              className={cn(
                "p-2 rounded-2xl transition-all active:scale-95 shadow-lg flex flex-col items-center justify-center gap-1",
                theme === 'dark' ? "bg-zinc-900 hover:bg-zinc-800 text-[#228B22]" : "bg-zinc-100 hover:bg-zinc-200 text-[#228B22]"
              )}
              title="Hábitos"
            >
              <div className="relative">
                <Settings className="w-4 h-4" />
                <Settings className="w-2.5 h-2.5 absolute -top-1 -right-1" />
                <Settings className="w-2.5 h-2.5 absolute -bottom-1 -left-1" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-tighter opacity-70">Hábitos</span>
            </button>

            <button 
              onClick={onDayClosure}
              className={cn(
                "p-2 rounded-2xl transition-all active:scale-95 shadow-lg flex flex-col items-center justify-center gap-1",
                theme === 'dark' ? "bg-zinc-900 hover:bg-zinc-800 text-amber-500" : "bg-zinc-100 hover:bg-zinc-200 text-amber-500"
              )}
              title="Cierre del Día"
            >
              <Key className="w-4 h-4" />
              <span className="text-[11px] font-bold uppercase tracking-tighter opacity-70">Cierre</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={cn(
      "flex flex-col flex-1",
      theme === 'dark' ? "bg-black" : "bg-[#f5f5f0]"
    )} style={{ height: '100dvh', minHeight: '-webkit-fill-available', position: 'relative' }}>
      {/* Discrepancy Alert */}
      <AnimatePresence>
        {showDiscrepancyAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
          >
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={cn(
                "relative mx-4 p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4 max-w-xs text-center border",
                theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
              )}
            >
              <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <div className="space-y-1">
                <h3 className={cn(
                  "text-sm font-bold",
                  theme === 'dark' ? "text-white" : "text-black"
                )}>
                  Discrepancia detectada
                </h3>
                <p className="text-[15px] text-zinc-500 leading-relaxed">
                  {discrepancyMessage}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className={cn(
        "flex flex-col border-b",
        theme === 'dark' ? "bg-black border-zinc-900" : "bg-[#f5f5f0] border-zinc-200"
      )}>
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-1">
            <button onClick={handlePrev} className="p-1 text-zinc-500 hover:text-white">
              <ChevronLeft className="w-[18px] h-[18px]" />
            </button>
            <h2 className={cn(
              "text-[18px] font-bold capitalize min-w-[100px] text-center",
              theme === 'dark' ? "text-white" : "text-black"
            )}>
              {format(currentDate, 'MMM yyyy', { locale: es }).replace('.', '')}
            </h2>
            <button onClick={handleNext} className="p-1 text-zinc-500 hover:text-white">
              <ChevronRight className="w-[18px] h-[18px]" />
            </button>
          </div>

          {/* View Selector (PC only) */}
          <div className={cn(
            "hidden md:flex items-center gap-1 p-1 rounded-xl mx-4",
            theme === 'dark' ? "bg-zinc-900/50" : "bg-white/50"
          )}>
            {(['day', 'week', 'month'] as ViewType[]).map((v) => (
              <button 
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1 rounded-lg text-[16px] font-bold uppercase tracking-wider transition-all", 
                  view === v 
                    ? (theme === 'dark' ? "bg-zinc-800 text-white" : "bg-white text-black shadow-sm") 
                    : (theme === 'dark' ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600")
                )}
              >
                {v === 'day' ? 'Día' : v === 'week' ? 'Semana' : 'Mes'}
              </button>
            ))}
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
                onClick={() => setActiveTab(item.id)}
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
      </div>

      {/* Swipeable Content */}
      <div className="flex-1 relative overflow-hidden">
        <div className="h-full w-full">
          {view === 'month' && renderMonthView()}
          {view === 'week' && renderWeekView()}
          {view === 'day' && renderDayView()}
        </div>
      </div>

      {/* Habits Modal */}
      <AnimatePresence>
        {isHabitsModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHabitsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={cn(
                "relative w-full max-w-4xl rounded-[32px] border p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]",
                theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200"
              )}
            >
              <div className="flex items-center justify-between mb-6 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#228B22]/20 rounded-2xl">
                    <Settings className="w-6 h-6 text-[#228B22]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Seguimiento de Hábitos</h3>
                    <p className="text-[15px] text-zinc-500">Semana del {format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'd')} al {format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMMM', { locale: es })}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsHabitsModalOpen(false)}
                  className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-x-auto custom-scrollbar">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="p-3 text-left text-[16px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800">Hábito</th>
                      {eachDayOfInterval({
                        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
                        end: endOfWeek(currentDate, { weekStartsOn: 1 })
                      }).map(day => (
                        <th key={day.toString()} className="p-3 text-center border-b border-zinc-800">
                          <div className="flex flex-col items-center">
                            <span className="text-[16px] font-bold text-zinc-500 uppercase">{format(day, 'eee', { locale: es })}</span>
                            <span className={cn(
                              "text-[17px] font-black",
                              isToday(day) ? "text-[#228B22]" : (theme === 'dark' ? "text-zinc-300" : "text-zinc-600")
                            )}>{format(day, 'd')}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Personal Habits */}
                    <tr>
                      <td colSpan={8} className="p-4 text-[16px] font-black text-[#228B22] uppercase tracking-[0.2em] bg-[#228B22]/5">
                        Personales
                      </td>
                    </tr>
                        {habits.filter(h => h.category === 'personal').map(habit => (
                          <tr key={habit.id} className="border-b border-zinc-900/50 hover:bg-white/5 transition-colors">
                            <td className="p-3 min-w-[150px]">
                              <div className="flex flex-col">
                                <span className={cn(
                                  "text-sm font-bold",
                                  theme === 'dark' ? "text-white" : "text-zinc-900"
                                )}>{habit.title}</span>
                                <span className="text-[16px] text-zinc-500">Racha: {habit.streak || 0} días</span>
                              </div>
                            </td>
                            {eachDayOfInterval({
                              start: startOfWeek(currentDate, { weekStartsOn: 1 }),
                              end: endOfWeek(currentDate, { weekStartsOn: 1 })
                            }).map(day => {
                              const dateStr = format(day, 'yyyy-MM-dd');
                              const completedDates = habit.completedDates || [];
                              const isCompleted = completedDates.includes(dateStr);
                              return (
                                <td key={day.toString()} className="p-3 text-center">
                                  <button
                                    onClick={() => onToggleHabitCompletion?.(habit.id, dateStr)}
                                    className={cn(
                                      "w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all mx-auto",
                                      isCompleted 
                                        ? "bg-[#228B22] border-[#228B22] text-white" 
                                        : "border-zinc-800 hover:border-[#228B22]"
                                    )}
                                  >
                                    {isCompleted && <Check className="w-5 h-5" />}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}

                    {/* Professional Habits */}
                    <tr>
                      <td colSpan={8} className="p-4 text-[16px] font-black text-blue-500 uppercase tracking-[0.2em] bg-blue-500/5">
                        Profesionales
                      </td>
                    </tr>
                        {habits.filter(h => h.category === 'professional').map(habit => (
                          <tr key={habit.id} className="border-b border-zinc-900/50 hover:bg-white/5 transition-colors">
                            <td className="p-3 min-w-[150px]">
                              <div className="flex flex-col">
                                <span className={cn(
                                  "text-sm font-bold",
                                  theme === 'dark' ? "text-white" : "text-zinc-900"
                                )}>{habit.title}</span>
                                <span className="text-[16px] text-zinc-500">Racha: {habit.streak || 0} días</span>
                              </div>
                            </td>
                            {eachDayOfInterval({
                              start: startOfWeek(currentDate, { weekStartsOn: 1 }),
                              end: endOfWeek(currentDate, { weekStartsOn: 1 })
                            }).map(day => {
                              const dateStr = format(day, 'yyyy-MM-dd');
                              const completedDates = habit.completedDates || [];
                              const isCompleted = completedDates.includes(dateStr);
                              return (
                                <td key={day.toString()} className="p-3 text-center">
                                  <button
                                    onClick={() => onToggleHabitCompletion?.(habit.id, dateStr)}
                                    className={cn(
                                      "w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all mx-auto",
                                      isCompleted 
                                        ? "bg-blue-500 border-blue-500 text-white" 
                                        : "border-zinc-800 hover:border-blue-500"
                                    )}
                                  >
                                    {isCompleted && <Check className="w-5 h-5" />}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>

              <button 
                onClick={() => setIsHabitsModalOpen(false)}
                className="w-full bg-[#228B22] text-white font-bold py-4 rounded-2xl shadow-xl active:scale-[0.98] transition-all mt-6 shrink-0"
              >
                Cerrar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Event Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={cn(
                "relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl border-t sm:border p-6 shadow-2xl",
                theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
              )}
            >
              <div className="flex flex-col max-h-[80vh]">
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <h3 className={cn(
                    "text-xl font-bold",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>{editingEventId ? 'Modificar Cita' : 'Nueva Cita'}</h3>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4 overflow-y-auto pr-1 scrollbar-hide pb-32">
                  {/* Priority Fields: Title, Date, Time */}
                  <div className="space-y-4 shrink-0">
                    <div className="space-y-1.5">
                      <label className="text-[16px] font-black text-zinc-500 uppercase tracking-widest">¿Qué?</label>
                      <input 
                        type="text" 
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="Título de la cita"
                        className={cn(
                          "w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#228B22]/50 text-[17px]",
                          theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-zinc-50 border-zinc-200 text-black"
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[16px] font-black text-zinc-500 uppercase tracking-widest">Fecha</label>
                        <div className="relative">
                          <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                          <input 
                            type="date" 
                            value={formDate}
                            onChange={(e) => setFormDate(e.target.value)}
                            className={cn(
                              "w-full border rounded-xl pl-9 pr-3 py-2.5 focus:outline-none text-[17px]",
                              theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-zinc-50 border-zinc-200 text-black"
                            )}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[16px] font-black text-zinc-500 uppercase tracking-widest">Hora Inicio</label>
                        <div className="relative">
                          <button
                            onClick={() => {
                              setIsStartTimePickerOpen(!isStartTimePickerOpen);
                              if (!isStartTimePickerOpen) startStartTimePickerTimer();
                            }}
                            className={cn(
                              "w-full border rounded-xl px-4 py-2.5 focus:outline-none text-left text-sm flex items-center justify-between",
                              theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-zinc-50 border-zinc-200 text-black"
                            )}
                          >
                            <span className="font-bold">{formTime}</span>
                            <Clock className="w-4 h-4 text-zinc-500" />
                          </button>
                          
                          <AnimatePresence>
                            {isStartTimePickerOpen && (
                              <>
                                <div className="fixed inset-0 z-[105]" onClick={() => setIsStartTimePickerOpen(false)} />
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                  className={cn(
                                    "absolute z-[110] top-full left-0 mt-2 p-4 rounded-2xl border shadow-2xl flex flex-col gap-4 min-w-[200px]",
                                    theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                                  )}
                                >
                                  <div className="flex items-center justify-center gap-4">
                                    <div className="flex flex-col items-center gap-1">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const [h, m] = formTime.split(':').map(Number);
                                          setFormTime(`${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                                          startStartTimePickerTimer();
                                        }}
                                        className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400"
                                      >
                                        <ChevronDown className="w-5 h-5 rotate-180" />
                                      </button>
                                      <span className="text-3xl font-black w-14 text-center">{formTime.split(':')[0]}</span>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const [h, m] = formTime.split(':').map(Number);
                                          setFormTime(`${String((h - 1 + 24) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                                          startStartTimePickerTimer();
                                        }}
                                        className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400"
                                      >
                                        <ChevronDown className="w-5 h-5" />
                                      </button>
                                    </div>
                                    <span className="text-3xl font-black text-zinc-500">:</span>
                                    <div className="flex flex-col items-center gap-1">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const [h, m] = formTime.split(':').map(Number);
                                          setFormTime(`${String(h).padStart(2, '0')}:${String((m + 15) % 60).padStart(2, '0')}`);
                                          startStartTimePickerTimer();
                                        }}
                                        className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400"
                                      >
                                        <ChevronDown className="w-5 h-5 rotate-180" />
                                      </button>
                                      <span className="text-3xl font-black w-14 text-center">{formTime.split(':')[1]}</span>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const [h, m] = formTime.split(':').map(Number);
                                          setFormTime(`${String(h).padStart(2, '0')}:${String((m - 15 + 60) % 60).padStart(2, '0')}`);
                                          startStartTimePickerTimer();
                                        }}
                                        className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400"
                                      >
                                        <ChevronDown className="w-5 h-5" />
                                      </button>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setIsStartTimePickerOpen(false);
                                    }}
                                    className="w-full bg-[#228B22] text-white font-bold py-2.5 rounded-xl text-sm"
                                  >
                                    Confirmar
                                  </button>
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[16px] font-black text-zinc-500 uppercase tracking-widest">Hora Fin</label>
                        <div className="relative">
                          <button
                            onClick={() => {
                              setIsEndTimePickerOpen(!isEndTimePickerOpen);
                              if (!isEndTimePickerOpen) startEndTimePickerTimer();
                            }}
                            className={cn(
                              "w-full border rounded-xl px-4 py-2.5 focus:outline-none text-left text-sm flex items-center justify-between",
                              theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-zinc-50 border-zinc-200 text-black"
                            )}
                          >
                            <span className="font-bold">{formEndTime}</span>
                            <Clock className="w-4 h-4 text-zinc-500" />
                          </button>
                          
                          <AnimatePresence>
                            {isEndTimePickerOpen && (
                              <>
                                <div className="fixed inset-0 z-[105]" onClick={() => setIsEndTimePickerOpen(false)} />
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                  className={cn(
                                    "absolute z-[110] top-full right-0 mt-2 p-4 rounded-2xl border shadow-2xl flex flex-col gap-4 min-w-[200px]",
                                    theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                                  )}
                                >
                                  <div className="flex items-center justify-center gap-4">
                                    <div className="flex flex-col items-center gap-1">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const [h, m] = formEndTime.split(':').map(Number);
                                          setFormEndTime(`${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                                          startEndTimePickerTimer();
                                        }}
                                        className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400"
                                      >
                                        <ChevronDown className="w-5 h-5 rotate-180" />
                                      </button>
                                      <span className="text-3xl font-black w-14 text-center">{formEndTime.split(':')[0]}</span>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const [h, m] = formEndTime.split(':').map(Number);
                                          setFormEndTime(`${String((h - 1 + 24) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                                          startEndTimePickerTimer();
                                        }}
                                        className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400"
                                      >
                                        <ChevronDown className="w-5 h-5" />
                                      </button>
                                    </div>
                                    <span className="text-3xl font-black text-zinc-500">:</span>
                                    <div className="flex flex-col items-center gap-1">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const [h, m] = formEndTime.split(':').map(Number);
                                          setFormEndTime(`${String(h).padStart(2, '0')}:${String((m + 15) % 60).padStart(2, '0')}`);
                                          startEndTimePickerTimer();
                                        }}
                                        className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400"
                                      >
                                        <ChevronDown className="w-5 h-5 rotate-180" />
                                      </button>
                                      <span className="text-3xl font-black w-14 text-center">{formEndTime.split(':')[1]}</span>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const [h, m] = formEndTime.split(':').map(Number);
                                          setFormEndTime(`${String(h).padStart(2, '0')}:${String((m - 15 + 60) % 60).padStart(2, '0')}`);
                                          startEndTimePickerTimer();
                                        }}
                                        className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400"
                                      >
                                        <ChevronDown className="w-5 h-5" />
                                      </button>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setIsEndTimePickerOpen(false);
                                    }}
                                    className="w-full bg-[#228B22] text-white font-bold py-2.5 rounded-xl text-sm"
                                  >
                                    Confirmar
                                  </button>
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      <div className="flex items-end pb-1">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <div className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                            isRecurring ? "bg-[#228B22] border-[#228B22]" : "border-zinc-700 group-hover:border-zinc-500"
                          )} onClick={() => setIsRecurring(!isRecurring)}>
                            {isRecurring && <Check className="w-3.5 h-3.5 text-white" />}
                          </div>
                          <span className="text-[15px] font-bold text-zinc-400">¿Es repetitiva?</span>
                        </label>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isRecurring && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                          className="space-y-4 overflow-hidden"
                        >
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <label className="text-[16px] font-black text-zinc-500 uppercase tracking-widest">Frecuencia</label>
                              <div className="relative">
                                <select
                                  value={recurrenceFrequency}
                                  onChange={(e) => setRecurrenceFrequency(e.target.value as any)}
                                  className={cn(
                                    "w-full border rounded-xl px-4 py-2.5 focus:outline-none appearance-none text-[17px] font-bold",
                                    theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-zinc-50 border-zinc-200 text-black"
                                  )}
                                >
                                  <option value="daily">Diaria</option>
                                  <option value="weekly">Semanal</option>
                                  <option value="biweekly">Quincenal</option>
                                  <option value="monthly">Mensual</option>
                                  <option value="yearly">Anual</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[16px] font-black text-zinc-500 uppercase tracking-widest">Fecha Fin</label>
                              <div className="relative">
                                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <input 
                                  type="date" 
                                  value={recurrenceEndDate}
                                  onChange={(e) => setRecurrenceEndDate(e.target.value)}
                                  className={cn(
                                    "w-full border rounded-xl pl-9 pr-3 py-2.5 focus:outline-none text-[17px] font-bold",
                                    theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-zinc-50 border-zinc-200 text-black"
                                  )}
                                />
                              </div>
                            </div>
                          </div>

                          {recurrenceFrequency === 'weekly' && (
                            <div className="space-y-2">
                              <label className="text-[16px] font-black text-zinc-500 uppercase tracking-widest">Días de la semana</label>
                              <div className="flex justify-between gap-1">
                                {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((day, index) => (
                                  <button
                                    key={day}
                                    onClick={() => {
                                      if (recurrenceDays.includes(index)) {
                                        setRecurrenceDays(recurrenceDays.filter(d => d !== index));
                                      } else {
                                        setRecurrenceDays([...recurrenceDays, index]);
                                      }
                                    }}
                                    className={cn(
                                      "w-8 h-8 rounded-full text-[16px] font-black transition-all border",
                                      recurrenceDays.includes(index)
                                        ? "bg-[#228B22] border-[#228B22] text-white"
                                        : theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-zinc-500" : "bg-zinc-100 border-zinc-200 text-zinc-500"
                                    )}
                                  >
                                    {day}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {recurrenceFrequency === 'biweekly' && (
                            <div className="flex items-start gap-2 p-3 rounded-xl bg-[#228B22]/10 border border-[#228B22]/20">
                              <HelpCircle className="w-4 h-4 text-[#228B22] shrink-0 mt-0.5" />
                              <p className="text-[14px] text-zinc-400 leading-tight">
                                Se marcarán citas cada 15 días a partir de la fecha de inicio.
                              </p>
                            </div>
                          )}

                          {recurrenceFrequency === 'monthly' && (
                            <div className="flex items-start gap-2 p-3 rounded-xl bg-[#228B22]/10 border border-[#228B22]/20">
                              <HelpCircle className="w-4 h-4 text-[#228B22] shrink-0 mt-0.5" />
                              <p className="text-[14px] text-zinc-400 leading-tight">
                                Se marcarán citas el mismo día del mes de la fecha de inicio.
                              </p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Secondary Fields: Goal, Location, Color */}
                  <div className="space-y-4 pt-2 border-t border-zinc-800/50">
                    <div className="space-y-1.5">
                      <label className="text-[16px] font-black text-zinc-500 uppercase tracking-widest">¿Vincular a una Meta?</label>
                      <div className="relative">
                        <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <select
                          value={formGoalId}
                          onChange={(e) => setFormGoalId(e.target.value)}
                          className={cn(
                            "w-full border rounded-xl pl-9 pr-8 py-2.5 focus:outline-none appearance-none text-[17px]",
                            theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-zinc-50 border-zinc-200 text-black"
                          )}
                        >
                          <option value="">Ninguna meta</option>
                          {goals.map(goal => (
                            <option key={goal.id} value={goal.id}>{goal.title}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[16px] font-black text-zinc-500 uppercase tracking-widest">¿Dónde?</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input 
                          type="text" 
                          value={formLocation}
                          onChange={(e) => setFormLocation(e.target.value)}
                          placeholder="Ubicación (opcional)"
                          className={cn(
                            "w-full border rounded-xl pl-9 pr-4 py-2.5 focus:outline-none text-[17px]",
                            theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-zinc-50 border-zinc-200 text-black"
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pb-2">
                      <label className="text-[16px] font-black text-zinc-500 uppercase tracking-widest">Categoría</label>
                      <div className="grid grid-cols-5 gap-2 px-1">
                        {CLIENT_COLORS.map(color => (
                          <button
                            key={color}
                            onClick={() => setFormColor(color)}
                            className={cn(
                              "w-7 h-7 rounded-full transition-transform active:scale-75 mx-auto",
                              formColor === color 
                                ? (theme === 'dark' ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110" : "ring-2 ring-black ring-offset-2 ring-offset-white scale-110") 
                                : "opacity-60"
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-6 shrink-0">
                  {editingEventId && onDeleteEvent && (
                    <button
                      onClick={() => {
                        onDeleteEvent(editingEventId);
                        setIsModalOpen(false);
                      }}
                      className={cn(
                        "flex-1 py-3.5 rounded-2xl font-bold text-[17px] transition-all",
                        theme === 'dark' ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" : "bg-red-50 text-red-600 hover:bg-red-100"
                      )}
                    >
                      Eliminar
                    </button>
                  )}
                  <button 
                    onClick={handleSaveEvent}
                    disabled={!formTitle}
                    className={cn(
                      "bg-[#228B22] disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl shadow-xl active:scale-[0.98] transition-all shrink-0",
                      editingEventId && onDeleteEvent ? "flex-[2]" : "w-full"
                    )}
                  >
                    {editingEventId ? 'Guardar Cambios' : 'Crear Cita'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface EventComponentProps {
  event: CalendarEvent;
  isSelected: boolean;
  topPercent: number;
  heightPercent: number;
  leftPercent: number;
  widthPercent: number;
  textColorClass: string;
  secondaryTextColorClass: string;
  handleInteractionStart: (event: CalendarEvent, mode: 'moving' | 'resizing-top' | 'resizing-bottom', pointerY: number) => void;
  startDeselectTimer: () => void;
  interactionMode: 'none' | 'moving' | 'resizing-top' | 'resizing-bottom';
  resizingEvent: { id: string, start?: string, end?: string } | null;
  selectedEventId: string | null;
  setSelectedEventId: (id: string | null) => void;
  setMode: (mode: 'none' | 'moving' | 'resizing-top' | 'resizing-bottom') => void;
  setResizingEvent: (data: { id: string, start?: string, end?: string } | null) => void;
  openEventModal: (date?: Date, time?: string, event?: CalendarEvent) => void;
  lastClickTime: number;
  setLastClickTime: (time: number) => void;
  longPressTimerRef: React.MutableRefObject<NodeJS.Timeout | null>;
  clickTimerRef: React.MutableRefObject<NodeJS.Timeout | null>;
  theme?: 'dark' | 'light';
}

const EventComponent: React.FC<EventComponentProps> = ({
  event,
  isSelected,
  topPercent,
  heightPercent,
  leftPercent,
  widthPercent,
  textColorClass,
  secondaryTextColorClass,
  handleInteractionStart,
  startDeselectTimer,
  interactionMode,
  resizingEvent,
  selectedEventId,
  setSelectedEventId,
  setMode,
  setResizingEvent,
  openEventModal,
  lastClickTime,
  setLastClickTime,
  longPressTimerRef,
  clickTimerRef,
  theme
}) => {
  const pointerMovedRef = React.useRef(false);
  const startPosRef = React.useRef({ x: 0, y: 0 });
  const isInteracting = interactionMode !== 'none' && resizingEvent?.id === event.id;

  return (
    <motion.div
      initial={false}
      onPointerDown={(e) => {
        e.stopPropagation();
        const pointerY = e.clientY;
        
        startPosRef.current = { x: e.clientX, y: e.clientY };
        pointerMovedRef.current = false;

        // Start long press timer for moving (500ms)
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = setTimeout(() => {
          handleInteractionStart(event, 'moving', pointerY);
          longPressTimerRef.current = null;
          if (window.navigator.vibrate) window.navigator.vibrate(30);
        }, 500);

        const handleMove = (moveEvent: PointerEvent) => {
          const dist = Math.sqrt(
            Math.pow(moveEvent.clientX - startPosRef.current.x, 2) + 
            Math.pow(moveEvent.clientY - startPosRef.current.y, 2)
          );
          if (dist > 15) {
            pointerMovedRef.current = true;
            if (longPressTimerRef.current) {
              clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
            }
          }
        };
        window.addEventListener('pointermove', handleMove);
        
        const cleanup = () => {
          window.removeEventListener('pointermove', handleMove);
          window.removeEventListener('pointerup', cleanup);
        };
        window.addEventListener('pointerup', cleanup);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }

        // If we are in an interaction mode, don't do anything on up
        if (interactionMode !== 'none') return;

        if (!pointerMovedRef.current) {
          const now = Date.now();
          if (now - lastClickTime < 300) {
            // Double Tap -> Show handles (tiradores)
            setSelectedEventId(event.id);
            startDeselectTimer();
            setLastClickTime(0);
            if (clickTimerRef.current) {
              clearTimeout(clickTimerRef.current);
              clickTimerRef.current = null;
            }
            if (window.navigator.vibrate) window.navigator.vibrate(10);
          } else {
            // Potential Single Tap -> Open modal (modificar cita)
            setLastClickTime(now);
            if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
            clickTimerRef.current = setTimeout(() => {
              openEventModal(undefined, undefined, event);
              clickTimerRef.current = null;
            }, 300);
          }
        }
      }}
      onPointerCancel={() => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => e.stopPropagation()}
      animate={{ 
        y: 0,
        scale: isInteracting ? 1.08 : (isSelected ? 1.02 : 1),
        zIndex: isInteracting ? 100 : (isSelected ? 50 : 20),
        boxShadow: isInteracting 
          ? "0 30px 60px -15px rgb(0 0 0 / 0.6)" 
          : (isSelected ? "0 15px 25px -5px rgb(0 0 0 / 0.4)" : "0 4px 6px -1px rgb(0 0 0 / 0.1)")
      }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      whileTap={isSelected ? { scale: 1 } : { scale: 0.98 }}
      className={cn(
        "absolute p-2 rounded-xl border cursor-grab active:cursor-grabbing calendar-event overflow-hidden",
        !isInteracting && "transition-all", // Disable transitions during interaction for precision
        isSelected ? "ring-2 ring-white ring-offset-2 ring-offset-black border-transparent" : "border-white/10"
      )}
      style={{ 
        top: `${topPercent}%`, 
        height: `${heightPercent}%`, 
        left: `calc(3rem + (100% - 3.5rem) * ${leftPercent / 100})`,
        width: `calc((100% - 3.5rem) * ${widthPercent / 100})`,
        backgroundColor: event.color,
        touchAction: 'none',
        transformOrigin: interactionMode === 'resizing-top' ? 'bottom' : 'top',
        zIndex: isInteracting ? 100 : (isSelected ? 50 : 20) // Ensure correct stacking even without motion animate
      }}
    >
      <p className={cn("text-[17px] font-bold truncate leading-tight drop-shadow-sm", textColorClass)}>{event.title}</p>
      {event.location && (
        <div className="flex items-center gap-1 mt-0.5">
          <MapPin className={cn("w-2 h-2", secondaryTextColorClass)} />
          <span className={cn("text-[14px] truncate", secondaryTextColorClass)}>{event.location}</span>
        </div>
      )}

      {/* Resize Handles - Circles */}
      {isSelected && (interactionMode === 'none' || interactionMode === 'resizing-top' || interactionMode === 'resizing-bottom') && (
        <>
          {/* Top Handle */}
          <div 
            className="absolute top-0 left-0 right-0 h-8 -translate-y-1/2 z-[150] cursor-ns-resize flex items-center justify-center touch-none"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
              }
              handleInteractionStart(event, 'resizing-top', e.clientY);
            }}
            onPointerUp={(e) => {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }}
          >
            <div className={cn(
              "w-6 h-6 rounded-full border-2 shadow-xl flex items-center justify-center transition-all duration-200",
              interactionMode === 'resizing-top' ? "scale-125 bg-white border-primary" : "scale-100 bg-white border-black",
              theme === 'dark' ? "bg-white border-black" : "bg-white border-zinc-900"
            )}>
              <div className={cn("w-2 h-2 rounded-full", theme === 'dark' ? "bg-black/20" : "bg-black/20")} />
            </div>
          </div>
          {/* Bottom Handle */}
          <div 
            className="absolute bottom-0 left-0 right-0 h-8 translate-y-1/2 z-[150] cursor-ns-resize flex items-center justify-center touch-none"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
              }
              handleInteractionStart(event, 'resizing-bottom', e.clientY);
            }}
            onPointerUp={(e) => {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }}
          >
            <div className={cn(
              "w-6 h-6 rounded-full border-2 shadow-xl flex items-center justify-center transition-all duration-200",
              interactionMode === 'resizing-bottom' ? "scale-125 bg-white border-primary" : "scale-100 bg-white border-black",
              theme === 'dark' ? "bg-white border-black" : "bg-white border-zinc-900"
            )}>
              <div className={cn("w-2 h-2 rounded-full", theme === 'dark' ? "bg-black/20" : "bg-black/20")} />
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
};
