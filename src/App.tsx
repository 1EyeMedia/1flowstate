/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Timer, 
  CheckSquare, 
  MessageSquare, 
  Users, 
  Plus, 
  LogOut, 
  Send, 
  Image as ImageIcon,
  Play,
  Pause,
  RotateCcw,
  Hash,
  Search,
  MoreVertical,
  X,
  User as UserIcon,
  BarChart2,
  Trophy,
  Zap,
  Bell,
  Volume2,
  VolumeX,
  LayoutDashboard,
  Clock,
  Target,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { 
  auth, 
  db, 
  signIn, 
  logout, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp, 
  Timestamp,
  limit
} from 'firebase/firestore';
import { format, subDays, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  AreaChart,
  Area
} from 'recharts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
import { User, Workspace, Message, Todo, FocusSession } from './types';

// --- Sounds ---
const SOUNDS = {
  START: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  FINISH: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  CLICK: 'https://assets.mixkit.co/active_storage/sfx/2567/2567-preview.mp3'
};

const playSound = (url: string, volume: number = 0.5) => {
  const audio = new Audio(url);
  audio.volume = volume;
  audio.play().catch(e => console.log('Audio play blocked'));
};

// --- Components ---

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error?.message?.startsWith('{')) {
        setHasError(true);
        setErrorInfo(event.error.message);
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 p-8 rounded-[40px] shadow-2xl max-w-md w-full border border-white/10">
          <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center text-red-500 mb-6">
            <Bell size={32} />
          </div>
          <h2 className="text-2xl font-black text-white mb-4 tracking-tighter">System Interruption</h2>
          <p className="text-white/60 mb-6">A critical error occurred while accessing the database. This might be due to missing permissions or a network issue.</p>
          <pre className="bg-black/40 p-4 rounded-2xl text-[10px] font-mono overflow-auto max-h-40 mb-6 border border-white/5 text-red-400">
            {errorInfo}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-white text-slate-950 py-4 rounded-2xl font-bold hover:scale-105 transition-all shadow-xl"
          >
            Reboot Workspace
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const Pomodoro = ({ user, workspaceId, isMuted }: { user: User, workspaceId: string, isMuted: boolean }) => {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      if (isRunning) {
        if (!isMuted) playSound(SOUNDS.FINISH);
        recordSession();
      }
      setIsRunning(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, timeLeft]);

  const recordSession = async () => {
    try {
      const sessionRef = doc(collection(db, 'users', user.uid, 'focusSessions'));
      await setDoc(sessionRef, {
        id: sessionRef.id,
        userId: user.uid,
        workspaceId,
        duration: 25, // Fixed 25 min for now
        timestamp: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/focusSessions`);
    }
  };

  useEffect(() => {
    const syncTimer = async () => {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          pomodoroTimeLeft: timeLeft,
          isTimerRunning: isRunning,
          status: isRunning ? 'focusing' : 'resting'
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      }
    };
    if (!isRunning || timeLeft % 10 === 0 || timeLeft === 0) {
      syncTimer();
    }
  }, [isRunning, timeLeft, user.uid]);

  const toggleTimer = () => {
    if (!isMuted) playSound(SOUNDS.CLICK);
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    if (!isMuted) playSound(SOUNDS.CLICK);
    setIsRunning(false);
    setTimeLeft(25 * 60);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="bg-white/5 backdrop-blur-3xl rounded-[40px] p-8 border border-white/10 shadow-2xl relative overflow-hidden group">
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/20 blur-[80px] rounded-full group-hover:bg-indigo-500/30 transition-all duration-700" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/20 blur-[80px] rounded-full group-hover:bg-purple-500/30 transition-all duration-700" />
      
      <div className="relative z-10 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-6 bg-white/5 px-4 py-2 rounded-full border border-white/10">
          <Clock size={14} className="text-indigo-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Individual Flow</span>
        </div>
        
        <div className="text-8xl font-black font-mono tracking-tighter mb-8 text-white drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] flex items-baseline">
          {String(minutes).padStart(2, '0')}
          <span className="text-4xl text-white/20 mx-1">:</span>
          {String(seconds).padStart(2, '0')}
        </div>

        <div className="flex gap-6">
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleTimer}
            className={cn(
              "w-20 h-20 rounded-[30px] flex items-center justify-center transition-all shadow-2xl",
              isRunning ? "bg-white text-slate-950" : "bg-indigo-500 text-white"
            )}
          >
            {isRunning ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={resetTimer}
            className="w-20 h-20 rounded-[30px] bg-white/5 text-white flex items-center justify-center backdrop-blur-md border border-white/10 hover:bg-white/10 transition-all"
          >
            <RotateCcw size={32} />
          </motion.button>
        </div>
        
        <div className="mt-8 flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", isRunning ? "bg-indigo-500 animate-ping" : "bg-white/20")} />
          <p className="text-white/40 text-xs font-bold uppercase tracking-widest">
            {isRunning ? 'Deep Focus Active' : 'Ready to Start'}
          </p>
        </div>
      </div>
    </div>
  );
};

const GroupTimer = ({ workspace, isMuted }: { workspace: Workspace, isMuted: boolean }) => {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (workspace.groupTimer) {
      const { timeLeft: remoteTime, isRunning: remoteRunning, lastUpdated } = workspace.groupTimer;
      
      if (remoteRunning) {
        const now = Date.now();
        const lastUpdateMs = lastUpdated instanceof Timestamp ? lastUpdated.toMillis() : Date.now();
        const elapsed = Math.floor((now - lastUpdateMs) / 1000);
        const adjustedTime = Math.max(0, remoteTime - elapsed);
        setTimeLeft(adjustedTime);
        setIsRunning(true);
      } else {
        setTimeLeft(remoteTime);
        setIsRunning(false);
      }
    }
  }, [workspace.groupTimer]);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, timeLeft]);

  const toggleGroupTimer = async () => {
    if (!isMuted) playSound(SOUNDS.CLICK);
    try {
      await updateDoc(doc(db, 'workspaces', workspace.id), {
        groupTimer: {
          timeLeft: timeLeft,
          isRunning: !isRunning,
          lastUpdated: serverTimestamp()
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `workspaces/${workspace.id}`);
    }
  };

  const resetGroupTimer = async () => {
    if (!isMuted) playSound(SOUNDS.CLICK);
    try {
      await updateDoc(doc(db, 'workspaces', workspace.id), {
        groupTimer: {
          timeLeft: 25 * 60,
          isRunning: false,
          lastUpdated: serverTimestamp()
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `workspaces/${workspace.id}`);
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="bg-indigo-600/20 backdrop-blur-3xl rounded-[40px] p-8 border border-indigo-500/30 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4">
        <Users size={20} className="text-indigo-400 opacity-50" />
      </div>
      <div className="relative z-10 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-4 bg-indigo-500/20 px-4 py-2 rounded-full border border-indigo-500/30">
          <Sparkles size={14} className="text-indigo-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200">Collective Flow</span>
        </div>
        
        <div className="text-6xl font-black font-mono tracking-tighter mb-6 text-white flex items-baseline">
          {String(minutes).padStart(2, '0')}
          <span className="text-2xl text-indigo-400/40 mx-1">:</span>
          {String(seconds).padStart(2, '0')}
        </div>

        <div className="flex gap-4">
          <button 
            onClick={toggleGroupTimer}
            className="px-6 py-3 rounded-2xl bg-indigo-500 text-white font-bold text-sm flex items-center gap-2 hover:bg-indigo-400 transition-all shadow-lg"
          >
            {isRunning ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
            {isRunning ? 'Pause Sync' : 'Start Sync'}
          </button>
          <button 
            onClick={resetGroupTimer}
            className="p-3 rounded-2xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

const Analytics = ({ user, workspaceId }: { user: User, workspaceId: string }) => {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [workspaceUsers, setWorkspaceUsers] = useState<User[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'users', user.uid, 'focusSessions'), orderBy('timestamp', 'desc'), limit(50));
    return onSnapshot(q, (snapshot) => {
      setSessions(snapshot.docs.map(doc => doc.data() as FocusSession));
    });
  }, [user.uid]);

  useEffect(() => {
    const q = query(collection(db, 'workspaces', workspaceId, 'todos'), where('createdBy', '==', user.uid));
    return onSnapshot(q, (snapshot) => {
      setTodos(snapshot.docs.map(doc => doc.data() as Todo));
    });
  }, [workspaceId, user.uid]);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('currentWorkspaceId', '==', workspaceId));
    return onSnapshot(q, (snapshot) => {
      setWorkspaceUsers(snapshot.docs.map(doc => doc.data() as User));
    });
  }, [workspaceId]);

  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), i);
      return {
        name: format(date, 'EEE'),
        date: date,
        minutes: 0
      };
    }).reverse();

    sessions.forEach(session => {
      const sessionDate = session.timestamp instanceof Timestamp ? session.timestamp.toDate() : new Date();
      const day = last7Days.find(d => isSameDay(d.date, sessionDate));
      if (day) day.minutes += session.duration;
    });

    return last7Days;
  }, [sessions]);

  const totalFocusTime = sessions.reduce((acc, s) => acc + s.duration, 0);
  const completedTodos = todos.filter(t => t.completed).length;
  
  // Simple ranking logic based on focus sessions in this workspace
  // In a real app, we'd query all users' sessions for this workspace
  const ranking = useMemo(() => {
    return workspaceUsers
      .map(u => ({ ...u, score: (u.pomodoroTimeLeft || 0) + (u.isTimerRunning ? 1000 : 0) }))
      .sort((a, b) => b.score - a.score);
  }, [workspaceUsers]);

  const userRank = ranking.findIndex(u => u.uid === user.uid) + 1;

  return (
    <div className="space-y-8 p-2">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 border border-white/10 p-6 rounded-[32px] flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 mb-4">
            <Zap size={24} />
          </div>
          <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">Total Focus</p>
          <h4 className="text-3xl font-black text-white tracking-tighter">{totalFocusTime}m</h4>
        </div>
        <div className="bg-white/5 border border-white/10 p-6 rounded-[32px] flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 mb-4">
            <CheckSquare size={24} />
          </div>
          <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">Tasks Done</p>
          <h4 className="text-3xl font-black text-white tracking-tighter">{completedTodos}</h4>
        </div>
        <div className="bg-white/5 border border-white/10 p-6 rounded-[32px] flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-400 mb-4">
            <Trophy size={24} />
          </div>
          <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">Workspace Rank</p>
          <h4 className="text-3xl font-black text-white tracking-tighter">#{userRank}</h4>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 p-8 rounded-[40px]">
        <h3 className="text-white font-bold mb-8 flex items-center gap-2">
          <BarChart2 size={20} className="text-indigo-500" /> Weekly Performance
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#ffffff40', fontSize: 12, fontWeight: 700 }} 
              />
              <YAxis hide />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff10', borderRadius: '16px' }}
                itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
              />
              <Area 
                type="monotone" 
                dataKey="minutes" 
                stroke="#6366f1" 
                strokeWidth={4}
                fillOpacity={1} 
                fill="url(#colorMinutes)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 p-8 rounded-[40px]">
        <h3 className="text-white font-bold mb-6 flex items-center gap-2">
          <Trophy size={20} className="text-amber-500" /> Workspace Leaderboard
        </h3>
        <div className="space-y-4">
          {ranking.slice(0, 5).map((u, i) => (
            <div key={u.uid} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
              <span className="text-white/20 font-black italic w-6">0{i + 1}</span>
              <img src={u.photoURL} className="w-10 h-10 rounded-xl border border-white/10" alt="" />
              <div className="flex-1">
                <p className="text-white font-bold text-sm">{u.displayName}</p>
                <p className="text-white/40 text-[10px] uppercase tracking-widest">{u.status}</p>
              </div>
              <div className="text-right">
                <p className="text-white font-black text-sm">{Math.floor((u.pomodoroTimeLeft || 0) / 60)}m</p>
                <p className="text-white/20 text-[10px] uppercase font-bold">Left</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TodoList = ({ workspaceId, userId, isMuted }: { workspaceId: string, userId: string, isMuted: boolean }) => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'workspaces', workspaceId, 'todos'),
      orderBy('timestamp', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      setTodos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Todo)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `workspaces/${workspaceId}/todos`));
  }, [workspaceId]);

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim()) return;
    if (!isMuted) playSound(SOUNDS.CLICK);
    try {
      const todoRef = doc(collection(db, 'workspaces', workspaceId, 'todos'));
      await setDoc(todoRef, {
        id: todoRef.id,
        workspaceId,
        text: newTodo,
        completed: false,
        createdBy: userId,
        timestamp: serverTimestamp()
      });
      setNewTodo('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `workspaces/${workspaceId}/todos`);
    }
  };

  const toggleTodo = async (todo: Todo) => {
    if (!isMuted) playSound(SOUNDS.CLICK);
    try {
      await updateDoc(doc(db, 'workspaces', workspaceId, 'todos', todo.id), {
        completed: !todo.completed
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `workspaces/${workspaceId}/todos/${todo.id}`);
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'workspaces', workspaceId, 'todos', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `workspaces/${workspaceId}/todos/${id}`);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <form onSubmit={addTodo} className="mb-6 relative">
        <input 
          type="text" 
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          placeholder="What's the next focus?"
          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-14 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
        />
        <button type="submit" className="absolute right-3 top-3 p-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-all shadow-lg active:scale-90">
          <Plus size={20} />
        </button>
      </form>
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {todos.map((todo) => (
            <motion.div 
              key={todo.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "group flex items-center gap-4 p-5 rounded-3xl border transition-all cursor-pointer",
                todo.completed ? "bg-emerald-500/10 border-emerald-500/20" : "bg-white/5 border-white/10 hover:bg-white/10"
              )}
              onClick={() => toggleTodo(todo)}
            >
              <div className={cn(
                "w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all",
                todo.completed ? "bg-emerald-500 border-emerald-500" : "border-white/20"
              )}>
                {todo.completed && <CheckSquare size={16} className="text-white" />}
              </div>
              <span className={cn(
                "flex-1 font-bold text-sm transition-all",
                todo.completed ? "text-white/30 line-through" : "text-white"
              )}>
                {todo.text}
              </span>
              <button 
                onClick={(e) => { e.stopPropagation(); deleteTodo(todo.id); }}
                className="opacity-0 group-hover:opacity-100 p-2 text-white/40 hover:text-red-400 transition-all"
              >
                <X size={18} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

const Chat = ({ workspaceId, user, isMuted }: { workspaceId: string, user: User, isMuted: boolean }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'workspaces', workspaceId, 'messages'),
      orderBy('timestamp', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `workspaces/${workspaceId}/messages`));
  }, [workspaceId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    if (!isMuted) playSound(SOUNDS.CLICK);
    try {
      const messageRef = doc(collection(db, 'workspaces', workspaceId, 'messages'));
      await setDoc(messageRef, {
        id: messageRef.id,
        workspaceId,
        senderId: user.uid,
        senderName: user.displayName,
        text: newMessage,
        timestamp: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `workspaces/${workspaceId}/messages`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white/5 backdrop-blur-3xl rounded-[40px] border border-white/10 overflow-hidden shadow-2xl">
      <div className="p-6 border-b border-white/10 bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg">
            <MessageSquare size={24} />
          </div>
          <div>
            <h3 className="text-white font-black tracking-tight">Team Stream</h3>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Real-time Sync</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="p-3 bg-white/5 rounded-xl text-white/40 hover:text-white transition-all"><Search size={20} /></button>
          <button className="p-3 bg-white/5 rounded-xl text-white/40 hover:text-white transition-all"><MoreVertical size={20} /></button>
        </div>
      </div>
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {messages.map((msg) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={msg.id} 
            className={cn(
              "flex flex-col max-w-[85%]",
              msg.senderId === user.uid ? "ml-auto items-end" : "items-start"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-white/40 font-black uppercase tracking-tighter">{msg.senderName}</span>
              <span className="text-[10px] text-white/20 font-bold">
                {msg.timestamp instanceof Timestamp ? format(msg.timestamp.toDate(), 'HH:mm') : '...'}
              </span>
            </div>
            <div className={cn(
              "p-4 rounded-[24px] text-sm shadow-xl font-medium leading-relaxed",
              msg.senderId === user.uid 
                ? "bg-indigo-500 text-white rounded-tr-none" 
                : "bg-white/10 text-white rounded-tl-none border border-white/10"
            )}>
              {msg.text}
            </div>
          </motion.div>
        ))}
      </div>

      <form onSubmit={sendMessage} className="p-6 bg-white/5 border-t border-white/10 flex gap-4">
        <button type="button" className="p-4 bg-white/5 rounded-2xl text-white/40 hover:text-white transition-all"><ImageIcon size={20} /></button>
        <input 
          type="text" 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Share a thought..."
          className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
        />
        <button type="submit" className="p-4 bg-indigo-500 text-white rounded-2xl hover:bg-indigo-600 transition-all shadow-xl active:scale-90">
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};

const Presence = ({ workspaceId }: { workspaceId: string }) => {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('currentWorkspaceId', '==', workspaceId));
    return onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as User));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
  }, [workspaceId]);

  return (
    <div className="space-y-6">
      <h3 className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 px-2">
        <Users size={14} /> Active Members
      </h3>
      <div className="space-y-4">
        {users.map((u) => (
          <div key={u.uid} className="flex items-center gap-4 group p-2 rounded-2xl hover:bg-white/5 transition-all">
            <div className="relative">
              <img src={u.photoURL} alt={u.displayName} className="w-12 h-12 rounded-2xl border-2 border-white/10 group-hover:border-indigo-500 transition-all shadow-lg" />
              <div className={cn(
                "absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-slate-900",
                u.status === 'focusing' ? "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]" : "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]"
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-black truncate tracking-tight">{u.displayName}</p>
              <div className="flex items-center gap-2">
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-tighter">
                  {u.status === 'focusing' ? 'Deep Focus' : 'Flowing'}
                </p>
                {u.status === 'focusing' && (
                  <span className="text-indigo-400 text-[10px] font-black">
                    {Math.floor((u.pomodoroTimeLeft || 0) / 60)}m
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const WorkspaceList = ({ onSelect }: { onSelect: (w: Workspace) => void }) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'workspaces'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setWorkspaces(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Workspace)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'workspaces'));
  }, []);

  const createWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const workspaceRef = doc(collection(db, 'workspaces'));
      await setDoc(workspaceRef, {
        id: workspaceRef.id,
        name: newName,
        createdBy: auth.currentUser?.uid,
        createdAt: serverTimestamp()
      });
      setNewName('');
      setShowCreate(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'workspaces');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Abstract Background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-indigo-600/20 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-purple-600/20 blur-[150px] rounded-full animate-pulse delay-1000" />
        <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] bg-emerald-500/10 blur-[120px] rounded-full animate-bounce duration-[10s]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-5xl w-full relative z-10"
      >
        <div className="flex flex-col md:flex-row items-center justify-between mb-16 gap-8">
          <div className="text-center md:text-left">
            <h1 className="text-7xl font-black text-white tracking-tighter mb-4 leading-none">Flow<span className="text-indigo-500">State</span></h1>
            <p className="text-white/40 font-bold text-lg uppercase tracking-[0.2em]">Collective Intelligence System</p>
          </div>
          <button 
            onClick={() => setShowCreate(true)}
            className="px-8 py-5 bg-white text-slate-950 rounded-[32px] font-black text-lg flex items-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)]"
          >
            <Plus size={24} /> New Workspace
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {workspaces.map((w) => (
            <motion.button
              key={w.id}
              whileHover={{ y: -10, scale: 1.02 }}
              onClick={() => onSelect(w)}
              className="p-10 bg-white/5 border border-white/10 rounded-[48px] text-left group relative overflow-hidden transition-all hover:bg-white/10 shadow-2xl"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center text-white mb-8 group-hover:bg-indigo-500 group-hover:rotate-12 transition-all duration-500 shadow-xl">
                  <Hash size={32} />
                </div>
                <h3 className="text-3xl font-black text-white mb-3 tracking-tight">{w.name}</h3>
                <div className="flex items-center gap-2 text-white/40 text-xs font-bold uppercase tracking-widest">
                  <Users size={14} />
                  <span>Active Workspace</span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        <AnimatePresence>
          {showCreate && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-50 flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 40 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 40 }}
                className="bg-slate-900 border border-white/10 p-12 rounded-[56px] max-w-lg w-full shadow-[0_40px_80px_rgba(0,0,0,0.5)]"
              >
                <div className="flex justify-between items-center mb-10">
                  <h2 className="text-4xl font-black text-white tracking-tighter">New Space</h2>
                  <button onClick={() => setShowCreate(false)} className="p-3 bg-white/5 rounded-2xl text-white/40 hover:text-white transition-all"><X /></button>
                </div>
                <form onSubmit={createWorkspace}>
                  <input 
                    autoFocus
                    type="text" 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Workspace Name"
                    className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 text-white text-xl mb-8 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all shadow-inner"
                  />
                  <button type="submit" className="w-full bg-indigo-500 text-white py-6 rounded-3xl font-black text-xl hover:bg-indigo-600 transition-all shadow-[0_20px_40px_rgba(99,102,241,0.3)] active:scale-95">
                    Launch Workspace
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [activeTab, setActiveTab] = useState<'flow' | 'analytics'>('flow');
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userRef);
        
        const userData: User = {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || 'Anonymous',
          email: firebaseUser.email || '',
          photoURL: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`,
          status: 'resting',
          lastActive: serverTimestamp() as any
        };

        if (!userDoc.exists()) {
          try {
            await setDoc(userRef, userData);
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, `users/${firebaseUser.uid}`);
          }
        }
        
        onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            setUser(doc.data() as User);
          }
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
  }, []);

  const handleSelectWorkspace = async (w: Workspace) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        currentWorkspaceId: w.id,
        lastActive: serverTimestamp()
      });
      setCurrentWorkspace(w);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleExitWorkspace = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        currentWorkspaceId: null
      });
      setCurrentWorkspace(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360, scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-3xl"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.15),transparent_60%)]" />
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-indigo-600/10 blur-[150px] rounded-full" />
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-xl w-full bg-white/5 backdrop-blur-3xl p-16 rounded-[64px] border border-white/10 shadow-[0_40px_80px_rgba(0,0,0,0.5)] text-center relative z-10"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[32px] mx-auto mb-10 flex items-center justify-center shadow-2xl rotate-12 hover:rotate-0 transition-transform duration-500">
            <Timer size={48} className="text-white" />
          </div>
          <h1 className="text-6xl font-black text-white tracking-tighter mb-6 leading-none">Flow<span className="text-indigo-500">State</span></h1>
          <p className="text-white/40 mb-12 font-bold text-lg leading-relaxed">The buttery smooth, colorful workspace for deep focus and collective intelligence.</p>
          <button 
            onClick={signIn}
            className="w-full bg-white text-slate-950 py-6 rounded-3xl font-black text-xl hover:scale-105 active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-4"
          >
            <img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="Google" />
            Launch with Google
          </button>
        </motion.div>
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <ErrorBoundary>
        <WorkspaceList onSelect={handleSelectWorkspace} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row h-screen overflow-hidden font-sans">
        {/* Sidebar */}
        <aside className="w-full md:w-80 bg-slate-900/80 backdrop-blur-3xl border-r border-white/5 flex flex-col p-8 gap-10 relative z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-xl rotate-6">
                <Timer size={24} />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tighter">FlowState</h2>
            </div>
            <button onClick={handleExitWorkspace} className="p-3 bg-white/5 rounded-xl text-white/40 hover:text-white transition-all">
              <LogOut size={20} />
            </button>
          </div>

          <nav className="space-y-2">
            <button 
              onClick={() => setActiveTab('flow')}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all",
                activeTab === 'flow' ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-white/40 hover:text-white hover:bg-white/5"
              )}
            >
              <LayoutDashboard size={20} /> Flow Space
            </button>
            <button 
              onClick={() => setActiveTab('analytics')}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all",
                activeTab === 'analytics' ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-white/40 hover:text-white hover:bg-white/5"
              )}
            >
              <BarChart2 size={20} /> Analytics
            </button>
          </nav>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
            <Presence workspaceId={currentWorkspace.id} />
          </div>

          <div className="pt-8 border-t border-white/5 flex items-center gap-4">
            <div className="relative">
              <img src={user.photoURL} alt={user.displayName} className="w-14 h-14 rounded-2xl border-2 border-white/10 shadow-lg" />
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className="absolute -top-2 -right-2 p-1.5 bg-slate-800 rounded-lg text-white/60 hover:text-white border border-white/10 shadow-lg"
              >
                {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-black truncate tracking-tight">{user.displayName}</p>
              <button onClick={logout} className="text-white/40 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-colors">Sign Out</button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col p-8 gap-8 relative overflow-hidden z-10">
          {/* Abstract Background Elements */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute top-[10%] right-[-5%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full animate-pulse" />
            <div className="absolute bottom-[10%] left-[-5%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse delay-1000" />
            <div className="absolute top-[40%] left-[20%] w-[20%] h-[20%] bg-emerald-500/5 blur-[100px] rounded-full" />
          </div>

          <header className="flex flex-col md:flex-row md:items-center justify-between relative z-20 gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-indigo-500/30">
                  Live Workspace
                </span>
                <span className="text-white/20 text-xs font-bold">/</span>
                <span className="text-white/40 text-xs font-bold uppercase tracking-widest">
                  {activeTab === 'flow' ? 'Flow Space' : 'Analytics Dashboard'}
                </span>
              </div>
              <h1 className="text-5xl font-black text-white tracking-tighter leading-none">
                <span className="text-indigo-500">#</span> {currentWorkspace.name}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl px-6 py-3 flex items-center gap-4 shadow-xl">
                <div className="flex -space-x-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center overflow-hidden">
                      <UserIcon size={14} className="text-white/20" />
                    </div>
                  ))}
                </div>
                <span className="text-white/60 text-xs font-black uppercase tracking-widest">Team Syncing</span>
              </div>
            </div>
          </header>

          <div className="flex-1 relative z-20 overflow-hidden">
            <AnimatePresence mode="wait">
              {activeTab === 'flow' ? (
                <motion.div 
                  key="flow"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="h-full grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-hidden"
                >
                  {/* Left Column: Timers & Todos */}
                  <div className="lg:col-span-4 flex flex-col gap-8 overflow-y-auto custom-scrollbar pr-2">
                    <Pomodoro user={user} workspaceId={currentWorkspace.id} isMuted={isMuted} />
                    <GroupTimer workspace={currentWorkspace} isMuted={isMuted} />
                    <div className="flex-1 bg-white/5 backdrop-blur-3xl rounded-[40px] p-10 border border-white/10 shadow-2xl flex flex-col min-h-[400px]">
                      <h3 className="text-white font-black text-xl mb-8 flex items-center gap-3">
                        <Target size={24} className="text-indigo-500" /> Focus Queue
                      </h3>
                      <TodoList workspaceId={currentWorkspace.id} userId={user.uid} isMuted={isMuted} />
                    </div>
                  </div>

                  {/* Right Column: Chat */}
                  <div className="lg:col-span-8 overflow-hidden h-full">
                    <Chat workspaceId={currentWorkspace.id} user={user} isMuted={isMuted} />
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="analytics"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="h-full overflow-y-auto custom-scrollbar pr-4"
                >
                  <Analytics user={user} workspaceId={currentWorkspace.id} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}
