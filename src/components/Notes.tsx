import React, { useState, useRef } from 'react';
import { Mic, Square, Trash2, Plus, StickyNote, Calendar as CalendarIcon, Target, CheckSquare, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Note } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface NotesProps {
  notes: Note[];
  onAddNote: (note: Omit<Note, 'id' | 'createdAt'>) => void;
  onDeleteNote: (id: string) => void;
  onConvertToEvent?: (content: string) => void;
  onConvertToGoal?: (content: string) => void;
  onConvertToTask?: (content: string) => void;
  theme?: 'dark' | 'light';
}

export default function Notes({ 
  notes, 
  onAddNote, 
  onDeleteNote, 
  onConvertToEvent,
  onConvertToGoal,
  onConvertToTask,
  theme = 'dark' 
}: NotesProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [textNote, setTextNote] = useState('');
  
  const transcriptionRef = useRef('');
  const recognitionRef = useRef<any>(null);
  const isSavingRef = useRef(false);

  const startRecording = () => {
    if (!('webkitSpeechRecognition' in window) && !('speechRecognition' in window)) {
      alert('Tu navegador no soporta el reconocimiento de voz. Por favor, usa Chrome o Edge.');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).speechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-ES';

    recognition.onstart = () => {
      setIsRecording(true);
      setTranscription('');
      transcriptionRef.current = '';
      isSavingRef.current = false;
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = 0; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }
      
      const currentFull = (finalTranscript + interimTranscript).trim().replace(/\s+/g, ' ');
      setTranscription(currentFull);
      transcriptionRef.current = currentFull;
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      
      // Guard to prevent multiple saves for the same session
      if (isSavingRef.current) return;
      
      let finalResult = transcriptionRef.current.trim();
      
      // Heuristic to remove phrase repetitions (e.g., "hola hola" or "recordar recordar")
      if (finalResult) {
        const words = finalResult.split(' ');
        // Remove consecutive identical words
        const deDuplicatedWords = words.filter((word, i, arr) => {
          if (i === 0) return true;
          return word.toLowerCase() !== arr[i-1].toLowerCase();
        });
        
        // Remove immediate phrase repetitions (1-3 words)
        let processedWords = [...deDuplicatedWords];
        for (let len = 1; len <= 3; len++) {
          for (let i = 0; i <= processedWords.length - 2 * len; i++) {
            const phrase1 = processedWords.slice(i, i + len).join(' ').toLowerCase();
            const phrase2 = processedWords.slice(i + len, i + 2 * len).join(' ').toLowerCase();
            if (phrase1 === phrase2) {
              processedWords.splice(i + len, len);
              i--; // Re-check from same position
            }
          }
        }
        finalResult = processedWords.join(' ');
      }

      if (finalResult && finalResult.length > 1) {
        isSavingRef.current = true;
        onAddNote({
          content: finalResult,
          type: 'voice'
        });
      }
      
      setTranscription('');
      transcriptionRef.current = '';
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      // We'll handle adding the note in onend to ensure we have the final result
    }
  };

  const handleAddTextNote = () => {
    if (!textNote.trim()) return;
    onAddNote({
      content: textNote,
      type: 'text'
    });
    setTextNote('');
  };

  return (
    <div className={cn(
      "flex flex-col h-full p-4 overflow-hidden",
      theme === 'dark' ? "bg-black text-white" : "bg-[#f5f5f0] text-black"
    )}>
      <div className="mb-6">
        <h2 className={cn(
          "text-2xl font-bold",
          theme === 'dark' ? "text-white" : "text-black"
        )}>Notas e Ideas</h2>
        <p className="text-zinc-500 text-[17px]">Captura tus pensamientos rápidamente</p>
      </div>

      {/* Input Section */}
      <div className="space-y-4 mb-8">
        <div className="relative">
          <textarea
            value={textNote}
            onChange={(e) => setTextNote(e.target.value)}
            placeholder="Escribe una idea..."
            className={cn(
              "w-full border rounded-2xl p-4 pr-12 text-[17px] focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[100px] resize-none",
              theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-zinc-200 text-black shadow-sm"
            )}
          />
          <button
            onClick={handleAddTextNote}
            disabled={!textNote.trim()}
            className="absolute bottom-4 right-4 p-2 bg-emerald-700 text-white rounded-xl disabled:opacity-50 active:scale-95 transition-all"
          >
            <Plus className="w-[18px] h-[18px]" />
          </button>
        </div>

        <div className="flex flex-col items-center justify-center py-4 gap-4">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="flex flex-col items-center gap-2 group"
            >
              <div className={cn(
                "w-16 h-16 border rounded-full flex items-center justify-center group-active:scale-90 transition-all group-hover:border-emerald-600",
                theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm"
              )}>
                <Mic className="w-8 h-8 text-emerald-500" />
              </div>
              <span className="text-[15px] text-zinc-500 font-medium uppercase tracking-widest">Grabar voz</span>
            </button>
          ) : (
            <div className="flex flex-col items-center gap-4 w-full max-w-md">
              <div className={cn(
                "w-full p-4 rounded-2xl border min-h-[80px] flex items-center justify-center text-center italic text-[17px] relative overflow-hidden",
                theme === 'dark' ? "bg-zinc-900/50 border-emerald-500/30 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-700"
              )}>
                {transcription ? (
                  <p className="animate-in fade-in slide-in-from-bottom-1 duration-300">{transcription}</p>
                ) : (
                  <div className="flex items-center gap-2 opacity-50">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Escuchando...</span>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 h-0.5 bg-emerald-500/20 w-full">
                  <motion.div 
                    className="h-full bg-emerald-500"
                    animate={{ width: ["0%", "100%"] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  />
                </div>
              </div>
              <button
                onClick={stopRecording}
                className="flex flex-col items-center gap-2"
              >
                <div className="w-16 h-16 bg-red-500/20 border border-red-500 rounded-full flex items-center justify-center animate-pulse">
                  <Square className="w-8 h-8 text-red-500 fill-red-500" />
                </div>
                <span className="text-[15px] text-red-500 font-bold uppercase tracking-widest">Detener</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* List Section */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-20">
        <AnimatePresence initial={false}>
          {notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
              <StickyNote className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-[17px]">No hay notas todavía</p>
            </div>
          ) : (
            notes.map((note) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  "border rounded-2xl p-4 flex items-start gap-4 group",
                  theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] text-zinc-500 font-bold uppercase tracking-wider">
                      {format(new Date(note.createdAt), "d MMM, HH:mm", { locale: es })}
                    </span>
                    <button
                      onClick={() => onDeleteNote(note.id)}
                      className="p-1 text-zinc-600 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-[18px] h-[18px]" />
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <p className={cn(
                      "text-[17px] whitespace-pre-wrap leading-relaxed",
                      theme === 'dark' ? "text-zinc-200" : "text-zinc-700"
                    )}>
                      {note.content}
                    </p>

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800/50">
                      <button
                        onClick={() => onConvertToTask?.(note.content)}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tighter transition-all active:scale-95",
                          theme === 'dark' ? "bg-zinc-800 text-zinc-400 hover:text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                        )}
                      >
                        <CheckSquare className="w-[18px] h-[18px]" />
                        Tarea
                      </button>
                      <button
                        onClick={() => onConvertToEvent?.(note.content)}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tighter transition-all active:scale-95",
                          theme === 'dark' ? "bg-zinc-800 text-zinc-400 hover:text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                        )}
                      >
                        <CalendarIcon className="w-[18px] h-[18px]" />
                        Cita
                      </button>
                      <button
                        onClick={() => onConvertToGoal?.(note.content)}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tighter transition-all active:scale-95",
                          theme === 'dark' ? "bg-zinc-800 text-zinc-400 hover:text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                        )}
                      >
                        <Target className="w-[18px] h-[18px]" />
                        Meta
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
