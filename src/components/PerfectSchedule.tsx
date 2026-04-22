import React, { useState, useEffect } from 'react';
import { X, Save, RotateCcw, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PerfectSchedule, Category, PerfectScheduleSlot } from '../types';
import { cn, getContrastColor } from '../lib/utils';

interface PerfectScheduleProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: PerfectSchedule;
  onSave: (schedule: PerfectSchedule) => void;
  categories: Category[];
  theme: 'dark' | 'light';
  workDayStart: number;
  workDayEnd: number;
}

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function PerfectScheduleView({
  isOpen,
  onClose,
  schedule,
  onSave,
  categories,
  theme,
  workDayStart,
  workDayEnd
}: PerfectScheduleProps) {
  const [localSchedule, setLocalSchedule] = useState<PerfectSchedule>(schedule);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [customText, setCustomText] = useState('');
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);

  const hours = Array.from(
    { length: Math.max(0, workDayEnd - workDayStart) }, 
    (_, i) => workDayStart + i
  );

  useEffect(() => {
    setLocalSchedule(schedule);
  }, [schedule]);

  useEffect(() => {
    const handleResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSlotClick = (dayIndex: number, hour: number) => {
    const key = `${dayIndex}-${hour}`;
    const newSlots = { ...localSchedule.slots };
    
    if (selectedCategory) {
      newSlots[key] = { categoryId: selectedCategory.id };
    } else if (customText.trim()) {
      newSlots[key] = { customText: customText.trim() };
    } else {
      delete newSlots[key];
    }
    
    setLocalSchedule({ slots: newSlots });
  };

  const clearSlot = (dayIndex: number, hour: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const key = `${dayIndex}-${hour}`;
    const newSlots = { ...localSchedule.slots };
    delete newSlots[key];
    setLocalSchedule({ slots: newSlots });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-md flex flex-col"
      >
        {/* Header */}
        <div className={cn(
          "flex items-center justify-between px-4 py-2 border-b shrink-0",
          theme === 'dark' ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-white"
        )}>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-[17px] font-bold">Horario Perfecto</h2>
            </div>
          </div>

          {/* Compact Category Selector */}
          <div className="flex-1 flex items-center justify-center gap-2 px-4 overflow-x-auto no-scrollbar">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(selectedCategory?.id === cat.id ? null : cat);
                  setCustomText('');
                }}
                className={cn(
                  "w-6 h-6 rounded-full shrink-0 transition-all border-2 flex items-center justify-center",
                  selectedCategory?.id === cat.id 
                    ? "border-white scale-110 shadow-lg" 
                    : "border-transparent opacity-60 hover:opacity-100"
                )}
                style={{ backgroundColor: cat.color }}
                title={cat.name}
              >
                {selectedCategory?.id === cat.id && (
                  <Save 
                    className="w-3 h-3" 
                    style={{ color: getContrastColor(cat.color) }} 
                  />
                )}
              </button>
            ))}
            <div className="h-6 w-px bg-zinc-800 mx-1 shrink-0" />
            <input 
              type="text"
              placeholder="Texto..."
              value={customText}
              onChange={(e) => {
                setCustomText(e.target.value);
                setSelectedCategory(null);
              }}
              className={cn(
                "w-24 px-2 py-1 rounded-lg text-[13px] font-bold border focus:outline-none focus:border-[#228B22] shrink-0",
                theme === 'dark' ? "bg-zinc-800 border-zinc-700 text-white" : "bg-white border-zinc-200 text-black"
              )}
            />
            <button 
              onClick={() => {
                setSelectedCategory(null);
                setCustomText('');
              }}
              className={cn(
                "p-1.5 rounded-full transition-all shrink-0",
                !selectedCategory && !customText ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-white"
              )}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => onSave(localSchedule)}
              className="bg-[#228B22] text-white px-3 py-1.5 rounded-lg font-bold text-[15px] active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Guardar</span>
            </button>
          </div>
        </div>

        {/* Grid Container */}
        <div className="flex-1 overflow-hidden relative flex flex-col p-2">
          {isPortrait && (
            <div className="md:hidden absolute inset-0 z-10 bg-black/60 flex items-center justify-center p-8 text-center backdrop-blur-sm">
              <div className="bg-zinc-900 p-6 rounded-[32px] border border-zinc-800 shadow-2xl">
                <div className="w-16 h-16 bg-[#228B22]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Info className="w-8 h-8 text-[#228B22]" />
                </div>
                <h3 className="text-lg font-bold mb-2">Gira tu dispositivo</h3>
                <p className="text-[17px] text-zinc-400">Para una mejor experiencia, por favor pon tu móvil en horizontal.</p>
              </div>
            </div>
          )}

          <div className={`flex-1 grid grid-cols-[50px_repeat(7,1fr)] grid-rows-[30px_repeat(${hours.length},1fr)] border border-zinc-800 rounded-xl overflow-hidden bg-black`}>
            {/* Header Row */}
            <div className="bg-zinc-900 border-b border-r border-zinc-800"></div>
            {DAYS.map((day, i) => (
              <div key={day} className="bg-zinc-900 border-b border-r border-zinc-800 flex items-center justify-center">
                <span className="text-[14px] font-black uppercase tracking-tighter text-zinc-500">{day.substring(0, 3)}</span>
              </div>
            ))}

            {/* Hour Rows */}
            {hours.map(hour => {
              const isWorkHour = hour >= workDayStart && hour < workDayEnd;
              return (
                <React.Fragment key={hour}>
                  <div className={cn(
                    "border-b border-r border-zinc-800 flex items-center justify-center",
                    isWorkHour ? "bg-zinc-900/30" : "bg-black"
                  )}>
                    <span className="text-[14px] font-mono text-zinc-500">{hour.toString().padStart(2, '0')}</span>
                  </div>
                  {DAYS.map((_, dayIndex) => {
                    const slot = localSchedule.slots[`${dayIndex}-${hour}`];
                    const category = slot?.categoryId ? categories.find(c => c.id === slot.categoryId) : null;
                    
                    return (
                      <div 
                        key={`${dayIndex}-${hour}`}
                        onClick={() => handleSlotClick(dayIndex, hour)}
                        className={cn(
                          "border-b border-r border-zinc-800 relative cursor-pointer transition-all hover:bg-white/5 group",
                          isWorkHour ? "bg-zinc-900/10" : "bg-black/20"
                        )}
                        style={{ backgroundColor: category?.color ? `${category.color}33` : undefined }}
                      >
                        {slot && (
                          <div className="absolute inset-0.5 rounded-sm flex flex-col items-center justify-center overflow-hidden">
                            {category ? (
                              <div 
                                className="w-full h-full rounded-[1px] flex items-center justify-center text-center" 
                                style={{ 
                                  backgroundColor: category.color,
                                  color: getContrastColor(category.color)
                                }}
                              >
                                <span className="text-[12px] font-bold leading-none px-0.5 truncate">{category.name}</span>
                              </div>
                            ) : slot.customText ? (
                              <div className="w-full h-full rounded-[1px] bg-zinc-700 flex items-center justify-center text-center">
                                <span className="text-[12px] font-bold text-white leading-none px-0.5 truncate">{slot.customText}</span>
                              </div>
                            ) : null}
                            <button 
                              onClick={(e) => clearSlot(dayIndex, hour, e)}
                              className="absolute -top-1 -right-1 bg-black/50 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            >
                              <X className="w-2 h-2 text-white" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
