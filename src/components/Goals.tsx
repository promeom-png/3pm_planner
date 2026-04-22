import React, { useState } from 'react';
import { 
  Target, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Plus, 
  X,
  Calendar as CalendarIcon,
  Briefcase,
  User,
  Heart,
  DollarSign,
  CheckSquare,
  Square,
  HelpCircle,
  ChevronDown
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { cn } from '../lib/utils';
import { Goal, Task, CalendarEvent, Habit } from '../types';
import { CLIENT_COLORS } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO } from 'date-fns';

interface GoalsProps {
  goals: Goal[];
  events: CalendarEvent[];
  habits: Habit[];
  onAddGoal: (goal: Omit<Goal, 'id' | 'progress' | 'status' | 'tasks'>) => void;
  onAddTask: (goalId: string, task: { title: string; date?: string; time?: string; color?: string }) => void;
  onToggleTask: (goalId: string, taskId: string) => void;
  onToggleEvent: (eventId: string) => void;
  onUpdateProgress: (id: string, progress: number) => void;
  onToggleHabit: (id: string) => void;
  onToggleHabitAcquired: (id: string) => void;
  onAddHabit: (habit: Omit<Habit, 'id' | 'completedDates' | 'acquired' | 'streak'>) => void;
  onEditHabit: (habit: Habit) => void;
  onDeleteHabit: (id: string) => void;
  theme?: 'dark' | 'light';
  onShowTutorial?: () => void;
}

const categoryIcons = {
  professional: Briefcase,
  personal: User,
  health: Heart,
  financial: DollarSign,
};

const categoryColors = {
  professional: 'text-blue-600 bg-blue-50',
  personal: 'text-purple-600 bg-purple-50',
  health: 'text-emerald-600 bg-emerald-50',
  financial: 'text-amber-600 bg-amber-50',
};

// CLIENT_COLORS is now imported from ../constants

export default function Goals({ 
  goals, 
  events, 
  habits,
  onAddGoal, 
  onAddTask, 
  onToggleTask, 
  onToggleEvent, 
  onToggleHabit,
  onToggleHabitAcquired,
  onAddHabit,
  onEditHabit,
  onDeleteHabit,
  theme = 'dark', 
  onShowTutorial 
}: GoalsProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);

  // New Goal Form State
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [goalDate, setGoalDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [goalTime, setGoalTime] = useState('09:00');
  const [goalColor, setGoalColor] = useState(CLIENT_COLORS[0]);

  // New Task Form State
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDate, setTaskDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [taskTime, setTaskTime] = useState('10:00');
  const [taskColor, setTaskColor] = useState('');

  // Habit Form State
  const [habitTitle, setHabitTitle] = useState('');
  const [habitCategory, setHabitCategory] = useState<'personal' | 'professional'>('personal');

  const handleSaveGoal = () => {
    if (!goalTitle) return;
    onAddGoal({
      title: goalTitle,
      description: goalDescription,
      category: 'professional',
      targetDate: goalDate,
      time: goalTime,
      color: goalColor,
    });
    setIsGoalModalOpen(false);
    setGoalTitle('');
    setGoalDescription('');
  };

  const handleSaveTask = () => {
    if (!taskTitle || !selectedGoalId) return;
    onAddTask(selectedGoalId, {
      title: taskTitle,
      date: taskDate,
      time: taskTime,
      color: taskColor || undefined
    });
    setIsTaskModalOpen(false);
    setTaskTitle('');
    setSelectedGoalId(null);
  };

  const handleSaveHabit = () => {
    if (!habitTitle) return;
    if (selectedHabit) {
      onEditHabit({
        ...selectedHabit,
        title: habitTitle,
        category: habitCategory
      });
    } else {
      onAddHabit({
        title: habitTitle,
        category: habitCategory
      });
    }
    setIsHabitModalOpen(false);
    setSelectedHabit(null);
    setHabitTitle('');
  };

  const filteredGoals = goals.filter(goal => {
    if (filter === 'all') return true;
    return goal.status === filter;
  });

  const chartData = goals.map(g => ({
    name: g.title.substring(0, 10) + '...',
    progress: g.progress,
    full: 100
  }));

  return (
    <div className={cn(
      "space-y-4 p-4 min-h-full pb-24",
      theme === 'dark' ? "bg-black" : "bg-[#f5f5f0]"
    )}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className={cn(
            "text-xl font-bold",
            theme === 'dark' ? "text-white" : "text-black"
          )}>Metas</h2>
        </div>
        <button 
          onClick={() => setIsGoalModalOpen(true)}
          className="p-2 bg-orange-500 text-white rounded-xl shadow-lg active:scale-90 transition-transform"
        >
          <Plus className="w-[18px] h-[18px]" />
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total', value: goals.length, icon: Target, color: 'text-emerald-400' },
          { label: 'Hecho', value: goals.filter(g => g.status === 'completed').length, icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'En curso', value: goals.filter(g => g.status === 'active').length, icon: Clock, color: 'text-amber-400' },
          { label: 'Progreso', value: Math.round(goals.reduce((acc, g) => acc + g.progress, 0) / (goals.length || 1)), icon: TrendingUp, color: 'text-emerald-400' },
        ].map((stat, i) => (
          <div key={i} className={cn(
            "p-3 rounded-2xl border flex items-center gap-3",
            theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm"
          )}>
            <div className={cn(
              "p-1.5 rounded-lg shrink-0", 
              theme === 'dark' ? "bg-zinc-800" : "bg-zinc-100",
              stat.color
            )}>
              <stat.icon className="w-[22px] h-[22px]" />
            </div>
            <div className="min-w-0">
              <p className="text-[16px] font-medium text-zinc-500 uppercase tracking-widest truncate">{stat.label}</p>
              <p className={cn(
                "text-[17px] font-bold",
                theme === 'dark' ? "text-white" : "text-black"
              )}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {['all', 'active', 'completed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={cn(
                "px-4 py-1.5 text-[15px] font-bold rounded-full transition-colors whitespace-nowrap",
                filter === f 
                  ? (theme === 'dark' ? "bg-white text-black" : "bg-black text-white") 
                  : (theme === 'dark' ? "bg-zinc-900 text-zinc-400 border border-zinc-800" : "bg-white text-zinc-500 border border-zinc-200")
              )}
            >
              {f === 'all' ? 'Todos' : f === 'active' ? 'Activos' : 'Hechos'}
            </button>
          ))}
        </div>

        <div className="grid gap-3">
          {filteredGoals.map(goal => {
            const Icon = categoryIcons[goal.category];
            const isExpanded = expandedGoalId === goal.id;
            const goalEvents = events.filter(e => e.goalId === goal.id);
            const totalItems = goal.tasks.length + goalEvents.length;
            const completedItems = goal.tasks.filter(t => t.completed).length + goalEvents.filter(e => e.completed).length;
            const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

            return (
              <div 
                key={goal.id} 
                className={cn(
                  "rounded-2xl border shadow-sm overflow-hidden transition-all",
                  theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                )}
              >
                <div 
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: `${goal.color}22`, color: goal.color }}
                      >
                        <Icon className="w-[22px] h-[22px]" />
                      </div>
                      <div>
                        <h3 className={cn(
                          "font-bold text-[17px]",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>{goal.title}</h3>
                        <p className="text-[16px] text-zinc-500 line-clamp-1">{goal.description || 'Sin descripción'}</p>
                        <p className="text-[16px] text-zinc-500">{goal.targetDate} • {goal.time}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[16px] font-bold">
                      <span className="text-zinc-500 uppercase tracking-widest">Índice de Cumplimiento</span>
                      <span className="text-emerald-400">{progress}</span>
                    </div>
                    <div className={cn(
                      "h-1.5 rounded-full overflow-hidden",
                      theme === 'dark' ? "bg-zinc-800" : "bg-zinc-100"
                    )}>
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className={cn(
                        "border-t",
                        theme === 'dark' ? "border-zinc-800 bg-zinc-950/50" : "border-zinc-100 bg-zinc-50/50"
                      )}
                    >
                      <div className="p-4 space-y-4">
                        {/* Tasks Section */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-[16px] font-black text-zinc-500 uppercase tracking-widest">Tareas</h4>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedGoalId(goal.id);
                                setTaskColor(goal.color);
                                setIsTaskModalOpen(true);
                              }}
                              className="p-1 bg-emerald-700 text-white rounded-lg active:scale-90 transition-transform"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          
                          <div className="space-y-2">
                            {goal.tasks.map(task => (
                              <div 
                                key={task.id}
                                className={cn(
                                  "flex items-center gap-3 p-2 rounded-xl border",
                                  theme === 'dark' ? "bg-zinc-900/50 border-zinc-800/50" : "bg-white border-zinc-100 shadow-sm"
                                )}
                              >
                                <button 
                                  onClick={() => onToggleTask(goal.id, task.id)}
                                  className={cn(
                                    "shrink-0 transition-colors",
                                    task.completed ? "text-emerald-500" : "text-zinc-600"
                                  )}
                                >
                                  {task.completed ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <p className={cn(
                                    "text-[15px] font-medium truncate",
                                    task.completed ? "text-zinc-600 line-through" : (theme === 'dark' ? "text-zinc-200" : "text-zinc-700")
                                  )}>
                                    {task.title}
                                  </p>
                                  {task.date && (
                                    <p className="text-[11px] text-zinc-500">
                                      {task.date} {task.time && `• ${task.time}`}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                            {goal.tasks.length === 0 && (
                              <p className="text-[16px] text-zinc-600 text-center py-2 italic">Sin tareas pendientes</p>
                            )}
                          </div>
                        </div>

                        {/* Appointments Section */}
                        {goalEvents.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-[16px] font-black text-zinc-500 uppercase tracking-widest">Citas Vinculadas</h4>
                            <div className="space-y-2">
                              {goalEvents.map(event => (
                                <div 
                                  key={event.id}
                                  className={cn(
                                    "flex items-center gap-3 p-2 rounded-xl border",
                                    theme === 'dark' ? "bg-zinc-900/50 border-zinc-800/50" : "bg-white border-zinc-100 shadow-sm"
                                  )}
                                >
                                  <button 
                                    onClick={() => onToggleEvent(event.id)}
                                    className={cn(
                                      "shrink-0 transition-colors",
                                      event.completed ? "text-emerald-500" : "text-zinc-600"
                                    )}
                                  >
                                    {event.completed ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <p className={cn(
                                      "text-[15px] font-medium truncate",
                                      event.completed ? "text-zinc-600 line-through" : (theme === 'dark' ? "text-zinc-200" : "text-zinc-700")
                                    )}>
                                      {event.title}
                                    </p>
                                    <p className="text-[11px] text-zinc-500">
                                      {format(parseISO(event.start), 'dd/MM/yyyy HH:mm')}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Habits Section */}
        <div className="space-y-4 mt-8">
          <div className="flex items-center justify-between">
            <h2 className={cn(
              "text-[23px] font-bold",
              theme === 'dark' ? "text-white" : "text-black"
            )}>Hábitos</h2>
            <button 
              onClick={() => {
                setSelectedHabit(null);
                setHabitTitle('');
                setHabitCategory('personal');
                setIsHabitModalOpen(true);
              }}
              className="p-2 bg-blue-500 text-white rounded-xl shadow-lg active:scale-90 transition-transform"
            >
              <Plus className="w-[22px] h-[22px]" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Personal Habits */}
            <div className="space-y-3">
              <h3 className="text-[13px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <User className="w-4 h-4" />
                Personales
              </h3>
              <div className="grid gap-2">
                {habits.filter(h => h.category === 'personal').map(habit => (
                  <div 
                    key={habit.id}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-2xl border transition-all",
                      theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm"
                    )}
                  >
                    <div 
                      className="flex items-center gap-3 flex-1 cursor-pointer"
                      onClick={() => {
                        setSelectedHabit(habit);
                        setHabitTitle(habit.title);
                        setHabitCategory(habit.category);
                        setIsHabitModalOpen(true);
                      }}
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        habit.acquired ? "bg-amber-500" : "bg-zinc-700"
                      )} />
                      <span className={cn(
                        "text-[17px] font-medium",
                        theme === 'dark' ? "text-white" : "text-black"
                      )}>{habit.title}</span>
                    </div>
                    <button 
                      onClick={() => onToggleHabitAcquired(habit.id)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-xl text-[13px] font-bold transition-all",
                        habit.acquired 
                          ? "bg-amber-500 text-white" 
                          : (theme === 'dark' ? "bg-zinc-800 text-zinc-400 hover:text-white" : "bg-zinc-100 text-zinc-500 hover:text-black")
                      )}
                    >
                      <Target className="w-4 h-4" />
                      {habit.acquired ? 'Adquirido' : 'Marcar Adquirido'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Professional Habits */}
            <div className="space-y-3">
              <h3 className="text-[13px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Profesionales
              </h3>
              <div className="grid gap-2">
                {habits.filter(h => h.category === 'professional').map(habit => (
                  <div 
                    key={habit.id}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-2xl border transition-all",
                      theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm"
                    )}
                  >
                    <div 
                      className="flex items-center gap-3 flex-1 cursor-pointer"
                      onClick={() => {
                        setSelectedHabit(habit);
                        setHabitTitle(habit.title);
                        setHabitCategory(habit.category);
                        setIsHabitModalOpen(true);
                      }}
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        habit.acquired ? "bg-amber-500" : "bg-zinc-700"
                      )} />
                      <span className={cn(
                        "text-[17px] font-medium",
                        theme === 'dark' ? "text-white" : "text-black"
                      )}>{habit.title}</span>
                    </div>
                    <button 
                      onClick={() => onToggleHabitAcquired(habit.id)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-xl text-[13px] font-bold transition-all",
                        habit.acquired 
                          ? "bg-amber-500 text-white" 
                          : (theme === 'dark' ? "bg-zinc-800 text-zinc-400 hover:text-white" : "bg-zinc-100 text-zinc-500 hover:text-black")
                      )}
                    >
                      <Target className="w-4 h-4" />
                      {habit.acquired ? 'Adquirido' : 'Marcar Adquirido'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Goal Modal */}
      <AnimatePresence>
        {isGoalModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGoalModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className={cn(
                "relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl border-t sm:border p-6 shadow-2xl",
                theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
              )}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className={cn(
                  "text-xl font-bold",
                  theme === 'dark' ? "text-white" : "text-black"
                )}>Nueva Meta</h3>
                <button onClick={() => setIsGoalModalOpen(false)} className="p-2 text-zinc-400"><X /></button>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[13px] font-black text-zinc-500 uppercase tracking-widest">¿Qué?</label>
                  <input 
                    type="text" 
                    value={goalTitle}
                    onChange={(e) => setGoalTitle(e.target.value)}
                    placeholder="Título de la meta"
                    className={cn(
                      "w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50",
                      theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-zinc-50 border-zinc-200 text-black"
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[16px] font-black text-zinc-500 uppercase tracking-widest">Descripción</label>
                  <textarea 
                    value={goalDescription}
                    onChange={(e) => setGoalDescription(e.target.value)}
                    placeholder="Describe tu meta..."
                    rows={3}
                    className={cn(
                      "w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none",
                      theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-zinc-50 border-zinc-200 text-black"
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[16px] font-black text-zinc-500 uppercase tracking-widest">Vencimiento</label>
                    <div className="relative">
                      <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-[22px] h-[22px] text-zinc-500" />
                      <input 
                        type="date" 
                        value={goalDate}
                        onChange={(e) => setGoalDate(e.target.value)}
                        className={cn(
                          "w-full border rounded-xl pl-10 pr-4 py-3 focus:outline-none",
                          theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-zinc-50 border-zinc-200 text-black"
                        )}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[13px] font-black text-zinc-500 uppercase tracking-widest">Hora</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-[22px] h-[22px] text-zinc-500" />
                      <input 
                        type="time" 
                        value={goalTime}
                        onChange={(e) => setGoalTime(e.target.value)}
                        className={cn(
                          "w-full border rounded-xl pl-10 pr-4 py-3 focus:outline-none",
                          theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-zinc-50 border-zinc-200 text-black"
                        )}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-3">
                    {CLIENT_COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => setGoalColor(color)}
                        className={cn(
                          "w-8 h-8 rounded-full transition-transform active:scale-75",
                          goalColor === color 
                            ? (theme === 'dark' ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110" : "ring-2 ring-black ring-offset-2 ring-offset-white scale-110") 
                            : "opacity-60"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <button 
                  onClick={handleSaveGoal}
                  disabled={!goalTitle}
                  className="w-full bg-orange-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl shadow-xl active:scale-[0.98] transition-all mt-4"
                >
                  Guardar Meta
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Task Modal */}
      <AnimatePresence>
        {isTaskModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTaskModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className={cn(
                "relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl border-t sm:border p-6 shadow-2xl",
                theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
              )}
            >
              <div className="flex flex-col max-h-[80vh]">
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <h3 className={cn(
                    "text-[23px] font-bold",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>Nueva Tarea</h3>
                  <button onClick={() => setIsTaskModalOpen(false)} className="p-2 text-zinc-400"><X /></button>
                </div>

                <div className="space-y-4 overflow-y-auto pr-1 scrollbar-hide">
                  {/* Priority Fields: Title, Date, Time */}
                  <div className="space-y-4 shrink-0">
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-black text-zinc-500 uppercase tracking-widest">¿Qué?</label>
                      <input 
                        type="text" 
                        value={taskTitle}
                        onChange={(e) => setTaskTitle(e.target.value)}
                        placeholder="Título de la tarea"
                        className={cn(
                          "w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-[17px]",
                          theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-zinc-50 border-zinc-200 text-black"
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[13px] font-black text-zinc-500 uppercase tracking-widest">Fecha</label>
                        <div className="relative">
                          <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                          <input 
                            type="date" 
                            value={taskDate}
                            onChange={(e) => setTaskDate(e.target.value)}
                            className={cn(
                              "w-full border rounded-xl pl-9 pr-3 py-2.5 focus:outline-none text-[17px]",
                              theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-zinc-50 border-zinc-200 text-black"
                            )}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[13px] font-black text-zinc-500 uppercase tracking-widest">Hora</label>
                        <div className="flex items-center gap-1.5">
                          <input 
                            type="number" 
                            min="0"
                            max="23"
                            placeholder="HH"
                            value={taskTime.split(':')[0]}
                            onChange={(e) => {
                              const h = e.target.value;
                              const m = taskTime.split(':')[1];
                              setTaskTime(`${h}:${m}`);
                            }}
                            className={cn(
                              "w-full border rounded-xl px-2 py-2.5 focus:outline-none text-center text-sm",
                              theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-zinc-50 border-zinc-200 text-black"
                            )}
                          />
                          <span className="text-zinc-500 font-bold">:</span>
                          <input 
                            type="number" 
                            min="0"
                            max="59"
                            placeholder="MM"
                            value={taskTime.split(':')[1]}
                            onChange={(e) => {
                              const h = taskTime.split(':')[0];
                              const m = e.target.value;
                              setTaskTime(`${h}:${m}`);
                            }}
                            className={cn(
                              "w-full border rounded-xl px-2 py-2.5 focus:outline-none text-center text-sm",
                              theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-zinc-50 border-zinc-200 text-black"
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Secondary Fields: Goal, Color */}
                  <div className="space-y-4 pt-2 border-t border-zinc-800/50">
                    <div className="space-y-1.5">
                      <label className="text-[16px] font-black text-zinc-500 uppercase tracking-widest">¿Vincular a una Meta?</label>
                      <div className="relative">
                        <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <select
                          value={selectedGoalId || ''}
                          onChange={(e) => setSelectedGoalId(e.target.value)}
                          className={cn(
                            "w-full border rounded-xl pl-9 pr-8 py-2.5 focus:outline-none appearance-none text-[17px]",
                            theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-zinc-50 border-zinc-200 text-black"
                          )}
                        >
                          {goals.map(goal => (
                            <option key={goal.id} value={goal.id}>{goal.title}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[16px] font-black text-zinc-500 uppercase tracking-widest">Categoría</label>
                      <div className="flex flex-wrap gap-2">
                        {CLIENT_COLORS.map(color => (
                          <button
                            key={color}
                            onClick={() => setTaskColor(color)}
                            className={cn(
                              "w-7 h-7 rounded-full transition-transform active:scale-75",
                              taskColor === color 
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

                <button 
                  onClick={handleSaveTask}
                  disabled={!taskTitle}
                  className="w-full bg-emerald-600 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl shadow-xl active:scale-[0.98] transition-all mt-6 shrink-0"
                >
                  Guardar Tarea
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* New Habit Modal */}
      <AnimatePresence>
        {isHabitModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHabitModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className={cn(
                "relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl border-t sm:border p-6 shadow-2xl",
                theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
              )}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className={cn(
                  "text-xl font-bold",
                  theme === 'dark' ? "text-white" : "text-black"
                )}>{selectedHabit ? 'Editar Hábito' : 'Nuevo Hábito'}</h3>
                <button onClick={() => setIsHabitModalOpen(false)} className="p-2 text-zinc-400"><X /></button>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[16px] font-black text-zinc-500 uppercase tracking-widest">¿Qué hábito quieres cultivar?</label>
                  <input 
                    type="text" 
                    value={habitTitle}
                    onChange={(e) => setHabitTitle(e.target.value)}
                    placeholder="Ej: Meditar, Leer, Ejercicio..."
                    className={cn(
                      "w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                      theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-zinc-50 border-zinc-200 text-black"
                    )}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[13px] font-black text-zinc-500 uppercase tracking-widest">Categoría</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setHabitCategory('personal')}
                      className={cn(
                        "flex items-center justify-center gap-2 p-3 rounded-xl border transition-all font-bold text-sm",
                        habitCategory === 'personal'
                          ? "bg-purple-500/10 border-purple-500 text-purple-500"
                          : (theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-500" : "bg-zinc-50 border-zinc-200 text-zinc-400")
                      )}
                    >
                      <User className="w-4 h-4" />
                      Personal
                    </button>
                    <button
                      onClick={() => setHabitCategory('professional')}
                      className={cn(
                        "flex items-center justify-center gap-2 p-3 rounded-xl border transition-all font-bold text-sm",
                        habitCategory === 'professional'
                          ? "bg-blue-500/10 border-blue-500 text-blue-500"
                          : (theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-500" : "bg-zinc-50 border-zinc-200 text-zinc-400")
                      )}
                    >
                      <Briefcase className="w-4 h-4" />
                      Profesional
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  {selectedHabit && (
                    <button 
                      onClick={() => {
                        if (confirm('¿Estás seguro de que quieres eliminar este hábito?')) {
                          onDeleteHabit(selectedHabit.id);
                          setIsHabitModalOpen(false);
                        }
                      }}
                      className="flex-1 bg-red-500/10 text-red-500 font-bold py-4 rounded-2xl active:scale-[0.98] transition-all"
                    >
                      Eliminar
                    </button>
                  )}
                  <button 
                    onClick={handleSaveHabit}
                    disabled={!habitTitle}
                    className={cn(
                      "flex-[2] bg-blue-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl shadow-xl active:scale-[0.98] transition-all",
                      !selectedHabit && "w-full"
                    )}
                  >
                    {selectedHabit ? 'Guardar Cambios' : 'Crear Hábito'}
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
