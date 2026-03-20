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
  Sparkles,
  Layers,
  Activity,
  Award
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
  limit,
  increment
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
  CLICK: 'https://assets.mixkit.co/active_storage/sfx/2567/2567-preview.mp3',
  SUCCESS: 'https://assets.mixkit.co/active_storage/sfx/2569/2569-preview.mp3'
};

const playSound = (url: string, volume: number = 0.5) => {
  try {
    const audio = new Audio(url);
    audio.volume = volume;
    audio.play().catch(e => console.log('Audio play blocked'));
  } catch (e) {
    console.log('Audio error');
  }
};

const AbstractBackground = () => (
  <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
    <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-indigo-500/10 blur-[160px] rounded-full animate-pulse" />
    <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-purple-500/10 blur-[160px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
    <div className="absolute top-[30%] left-[20%] w-[40%] h-[40%] bg-emerald-500/5 blur-[140px] rounded-full animate-pulse" style={{ animationDelay: '4s' }} />
    <div className="absolute top-[10%] right-[20%] w-[30%] h-[30%] bg-amber-500/5 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '6s' }} />
    <svg className="absolute inset-0 w-full h-full opacity-[0.05] mix-blend-overlay" xmlns="http://www.w3.org/2000/svg">
      <filter id="noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter="url(#noise)" />
    </svg>
  </div>
);

const NavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <motion.button
    whileHover={{ scale: 1.05, x: 4 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-4 p-4 rounded-2xl font-black transition-all relative group overflow-hidden",
      active 
        ? "bg-indigo-500 text-white shadow-xl shadow-indigo-500/40" 
        : "text-white/40 hover:text-white hover:bg-white/5"
    )}
  >
    {active && (
      <motion.div 
        layoutId="nav-glow"
        className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent pointer-events-none"
      />
    )}
    <div className={cn(
      "p-2 rounded-xl transition-colors",
      active ? "bg-white/20" : "bg-white/5 group-hover:bg-white/10"
    )}>
      {icon}
    </div>
    <span className="uppercase tracking-widest text-[10px]">{label}</span>
    {active && (
      <motion.div 
        layoutId="nav-indicator"
        className="absolute right-0 w-1.5 h-8 bg-white rounded-l-full"
      />
    )}
  </motion.button>
);

const TeamFocus = ({ workspaceId }: { workspaceId: string }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [allPersonalTodos, setAllPersonalTodos] = useState<Record<string, Todo[]>>({});

  useEffect(() => {
    const q = query(collection(db, 'users'), where('currentWorkspaceId', '==', workspaceId));
    const unsubUsers = onSnapshot(q, (snapshot) => {
      const workspaceUsers = snapshot.docs.map(doc => doc.data() as User);
      setUsers(workspaceUsers);
      
      workspaceUsers.forEach(u => {
        const todoQ = query(
          collection(db, 'workspaces', workspaceId, 'personalTodos'),
          where('createdBy', '==', u.uid),
          orderBy('timestamp', 'desc'),
          limit(3)
        );
        onSnapshot(todoQ, (todoSnap) => {
          setAllPersonalTodos(prev => ({
            ...prev,
            [u.uid]: todoSnap.docs.map(d => ({ id: d.id, ...d.data() } as Todo))
          }));
        });
      });
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    return () => unsubUsers();
  }, [workspaceId]);

  return (
    <div className="space-y-6">
      <h3 className="text-white font-black text-xl mb-6 flex items-center gap-3">
        <Layers size={24} className="text-purple-500" /> Team Focus Stream
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {users.map((u) => (
          <motion.div 
            key={u.uid}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/5 backdrop-blur-2xl border border-white/10 p-6 rounded-[32px] hover:bg-white/10 transition-all group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="relative">
                <img src={u.photoURL} alt={u.displayName} className="w-12 h-12 rounded-2xl border-2 border-white/10 shadow-lg" />
                <div className={cn(
                  "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-4 border-slate-900",
                  u.status === 'focusing' ? "bg-red-500" : "bg-emerald-500"
                )} />
              </div>
              <div className="min-w-0">
                <p className="text-white font-black text-sm truncate tracking-tight">{u.displayName}</p>
                <p className="text-white/40 text-[8px] uppercase font-black tracking-widest">
                  {u.status === 'focusing' ? 'Deep Focus' : 'Flowing'}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {allPersonalTodos[u.uid]?.length ? (
                allPersonalTodos[u.uid].map(todo => (
                  <div key={todo.id} className="flex items-center gap-2 text-[11px] text-white/60 bg-black/20 p-2 rounded-xl border border-white/5">
                    <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", todo.completed ? "bg-emerald-500" : "bg-white/20")} />
                    <span className={cn("truncate", todo.completed && "line-through opacity-40")}>{todo.text}</span>
                  </div>
                ))
              ) : (
                <p className="text-[10px] text-white/20 italic font-medium px-2">No active focus tasks...</p>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

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

const Pomodoro = ({ user, workspaceId, isMuted, onSessionComplete }: { user: User, workspaceId: string, isMuted: boolean, onSessionComplete?: (duration: number) => void }) => {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionType, setSessionType] = useState<'work' | 'break'>('work');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartTime = useRef<Date | null>(null);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      if (!sessionStartTime.current) sessionStartTime.current = new Date();
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      if (isRunning) {
        if (!isMuted) playSound(SOUNDS.FINISH);
        if (sessionType === 'work') {
          recordSession();
          if (onSessionComplete) onSessionComplete(25);
          setSessionType('break');
          setTimeLeft(5 * 60);
        } else {
          setSessionType('work');
          setTimeLeft(25 * 60);
        }
      }
      setIsRunning(false);
      sessionStartTime.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, timeLeft, sessionType]);

  const recordSession = async () => {
    try {
      const sessionRef = doc(collection(db, 'users', user.uid, 'focusSessions'));
      const duration = 25;
      await setDoc(sessionRef, {
        id: sessionRef.id,
        userId: user.uid,
        workspaceId,
        duration,
        type: 'individual',
        timestamp: serverTimestamp(),
        completedTasks: []
      });

      // Update user's total focus time
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        totalFocusTime: increment(duration),
        totalSessions: increment(1),
        lastActive: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/focusSessions`);
    }
  };

  const toggleTimer = () => {
    if (!isMuted) playSound(isRunning ? SOUNDS.CLICK : SOUNDS.START);
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    if (!isMuted) playSound(SOUNDS.CLICK);
    setIsRunning(false);
    setSessionType('work');
    setTimeLeft(25 * 60);
  };

  return (
    <div className="bg-white/5 backdrop-blur-3xl rounded-[40px] p-8 border border-white/10 shadow-2xl relative overflow-hidden group">
      <div className={cn(
        "absolute inset-0 transition-opacity duration-1000",
        sessionType === 'work' ? "bg-indigo-500/5" : "bg-emerald-500/5"
      )} />
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/20 blur-[80px] rounded-full group-hover:bg-indigo-500/30 transition-all duration-700" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/20 blur-[80px] rounded-full group-hover:bg-purple-500/30 transition-all duration-700" />
      
      <div className="relative z-10 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-6 bg-white/5 px-4 py-2 rounded-full border border-white/10">
          {sessionType === 'work' ? <Target size={14} className="text-indigo-400" /> : <Sparkles size={14} className="text-emerald-400" />}
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
            {sessionType === 'work' ? 'Deep Work' : 'Short Break'}
          </span>
        </div>
        
        <div className="text-8xl font-black font-mono tracking-tighter mb-8 text-white drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] flex items-baseline">
          {formatTime(timeLeft).split(':')[0]}
          <span className="text-4xl text-white/20 mx-1 animate-pulse">:</span>
          {formatTime(timeLeft).split(':')[1]}
        </div>

        <div className="flex gap-6">
          <motion.button 
            whileHover={{ scale: 1.1, rotate: isRunning ? 0 : 5 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleTimer}
            className={cn(
              "w-20 h-20 rounded-[30px] flex items-center justify-center transition-all shadow-2xl",
              isRunning ? "bg-white text-slate-950" : (sessionType === 'work' ? "bg-indigo-500 text-white" : "bg-emerald-500 text-white")
            )}
          >
            {isRunning ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.1, rotate: -5 }}
            whileTap={{ scale: 0.9 }}
            onClick={resetTimer}
            className="w-20 h-20 rounded-[30px] bg-white/5 text-white flex items-center justify-center backdrop-blur-md border border-white/10 hover:bg-white/10 transition-all"
          >
            <RotateCcw size={32} />
          </motion.button>
        </div>
        
        <div className="mt-8 flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full", 
            isRunning ? (sessionType === 'work' ? "bg-indigo-500 animate-ping" : "bg-emerald-500 animate-ping") : "bg-white/20"
          )} />
          <p className="text-white/40 text-xs font-bold uppercase tracking-widest">
            {isRunning ? (sessionType === 'work' ? 'Focusing...' : 'Resting...') : 'Ready to Flow'}
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
    const q = query(collection(db, 'users', user.uid, 'focusSessions'), orderBy('timestamp', 'desc'), limit(100));
    return onSnapshot(q, (snapshot) => {
      setSessions(snapshot.docs.map(doc => doc.data() as FocusSession));
    });
  }, [user.uid]);

  useEffect(() => {
    const q = query(collection(db, 'workspaces', workspaceId, 'todos'), where('createdBy', '==', user.uid));
    const q2 = query(collection(db, 'workspaces', workspaceId, 'personalTodos'), where('createdBy', '==', user.uid));
    
    const unsub1 = onSnapshot(q, (snapshot) => {
      const sharedTodos = snapshot.docs.map(doc => doc.data() as Todo);
      setTodos(prev => {
        const personal = prev.filter(t => !sharedTodos.find(st => st.id === t.id));
        return [...sharedTodos, ...personal];
      });
    });

    const unsub2 = onSnapshot(q2, (snapshot) => {
      const personalTodos = snapshot.docs.map(doc => doc.data() as Todo);
      setTodos(prev => {
        const shared = prev.filter(t => !personalTodos.find(pt => pt.id === t.id));
        return [...shared, ...personalTodos];
      });
    });

    return () => { unsub1(); unsub2(); };
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
        minutes: 0,
        tasks: 0
      };
    }).reverse();

    sessions.forEach(session => {
      const sessionDate = session.timestamp instanceof Timestamp ? session.timestamp.toDate() : new Date();
      const day = last7Days.find(d => isSameDay(d.date, sessionDate));
      if (day) day.minutes += session.duration;
    });

    todos.forEach(todo => {
      if (todo.completed && todo.timestamp) {
        const todoDate = todo.timestamp instanceof Timestamp ? todo.timestamp.toDate() : new Date();
        const day = last7Days.find(d => isSameDay(d.date, todoDate));
        if (day) day.tasks += 1;
      }
    });

    return last7Days;
  }, [sessions, todos]);

  const totalFocusTime = sessions.reduce((acc, s) => acc + s.duration, 0);
  const completedTodos = todos.filter(t => t.completed).length;
  
  const ranking = useMemo(() => {
    return workspaceUsers
      .map(u => ({ ...u, score: u.totalFocusTime || 0 }))
      .sort((a, b) => b.score - a.score);
  }, [workspaceUsers]);

  const userRank = ranking.findIndex(u => u.uid === user.uid) + 1;

  const focusEfficiency = useMemo(() => {
    if (sessions.length === 0) return 0;
    const totalPossible = sessions.length * 25;
    return Math.round((totalFocusTime / totalPossible) * 100);
  }, [sessions, totalFocusTime]);

  return (
    <div className="space-y-12 p-2 pb-20">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tighter mb-2">Deep Analytics</h2>
          <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Your cognitive performance metrics</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white/5 px-6 py-3 rounded-2xl border border-white/10 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-white font-black text-sm">Live Sync Active</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Focus', value: `${totalFocusTime}m`, icon: Zap, color: 'text-indigo-400', bg: 'bg-indigo-500/20' },
          { label: 'Tasks Done', value: completedTodos, icon: CheckSquare, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
          { label: 'Workspace Rank', value: `#${userRank}`, icon: Trophy, color: 'text-amber-400', bg: 'bg-amber-500/20' },
          { label: 'Efficiency', value: `${focusEfficiency}%`, icon: Activity, color: 'text-purple-400', bg: 'bg-purple-500/20' }
        ].map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[40px] flex flex-col items-center text-center relative overflow-hidden group"
          >
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity", stat.bg.replace('20', '10'))} />
            <div className={cn("w-16 h-16 rounded-[24px] flex items-center justify-center mb-6 relative z-10", stat.bg, stat.color)}>
              <stat.icon size={32} />
            </div>
            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2 relative z-10">{stat.label}</p>
            <h4 className="text-4xl font-black text-white tracking-tighter relative z-10">{stat.value}</h4>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[40px] relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <BarChart2 size={120} className="text-indigo-500" />
          </div>
          <h3 className="text-white font-black text-xl mb-8 flex items-center gap-2 relative z-10">
            <Sparkles size={24} className="text-indigo-500" /> Focus Velocity
          </h3>
          <div className="h-64 w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#ffffff30', fontSize: 10, fontWeight: 900 }} 
                />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff10', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}
                  itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="minutes" 
                  stroke="#6366f1" 
                  strokeWidth={6}
                  fillOpacity={1} 
                  fill="url(#colorMinutes)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[40px] relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <CheckSquare size={120} className="text-emerald-500" />
          </div>
          <h3 className="text-white font-black text-xl mb-8 flex items-center gap-2 relative z-10">
            <Target size={24} className="text-emerald-500" /> Task Momentum
          </h3>
          <div className="h-64 w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#ffffff30', fontSize: 10, fontWeight: 900 }} 
                />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff10', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}
                  itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                />
                <Bar dataKey="tasks" radius={[10, 10, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#10b981' : '#10b98140'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[40px]">
          <h3 className="text-white font-black text-xl mb-6 flex items-center gap-2">
            <Clock size={24} className="text-purple-500" /> Recent Sessions
          </h3>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-white/40 group-hover:text-indigo-400 transition-colors">
                  <Play size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold text-sm">Deep Focus Session</p>
                  <p className="text-white/40 text-[10px] uppercase font-black tracking-widest">
                    {s.timestamp instanceof Timestamp ? format(s.timestamp.toDate(), 'MMM d, HH:mm') : '...'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white font-black text-sm">{s.duration}m</p>
                  <div className="flex gap-1 mt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className={cn("w-1 h-1 rounded-full", i < 3 ? "bg-indigo-500" : "bg-white/10")} />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[40px]">
          <h3 className="text-white font-black text-xl mb-6 flex items-center gap-2">
            <Award size={24} className="text-amber-500" /> Hall of Fame
          </h3>
          <div className="space-y-4">
            {ranking.slice(0, 5).map((u, i) => (
              <div key={u.uid} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 relative overflow-hidden group">
                {i === 0 && <div className="absolute inset-0 bg-amber-500/5" />}
                <span className={cn(
                  "text-xl font-black italic w-8 relative z-10",
                  i === 0 ? "text-amber-500" : "text-white/10"
                )}>
                  {i + 1}
                </span>
                <img src={u.photoURL} className="w-10 h-10 rounded-xl border border-white/10 relative z-10" alt="" />
                <div className="flex-1 relative z-10">
                  <p className="text-white font-bold text-sm truncate">{u.displayName}</p>
                  <div className="flex items-center gap-1">
                    <div className={cn("w-1.5 h-1.5 rounded-full", u.status === 'focusing' ? "bg-red-500" : "bg-emerald-500")} />
                    <p className="text-white/40 text-[8px] uppercase font-black tracking-widest">{u.status}</p>
                  </div>
                </div>
                <div className="text-right relative z-10">
                  <p className="text-white font-black text-sm">{Math.floor((u.totalFocusTime || 0) / 60)}h {Math.floor((u.totalFocusTime || 0) % 60)}m</p>
                  <p className="text-white/20 text-[8px] uppercase font-black">Total Focus</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const TodoList = ({ workspaceId, userId, isMuted, isPersonal = false }: { workspaceId: string, userId: string, isMuted: boolean, isPersonal?: boolean }) => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const collectionPath = isPersonal ? 'personalTodos' : 'todos';

  useEffect(() => {
    const q = query(
      collection(db, 'workspaces', workspaceId, collectionPath),
      isPersonal ? where('createdBy', '==', userId) : orderBy('timestamp', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      setTodos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Todo)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `workspaces/${workspaceId}/${collectionPath}`));
  }, [workspaceId, userId, isPersonal]);

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim()) return;
    if (!isMuted) playSound(SOUNDS.CLICK);
    try {
      const todoRef = doc(collection(db, 'workspaces', workspaceId, collectionPath));
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
      handleFirestoreError(error, OperationType.CREATE, `workspaces/${workspaceId}/${collectionPath}`);
    }
  };

  const toggleTodo = async (todo: Todo) => {
    if (!isMuted) playSound(SOUNDS.CLICK);
    try {
      await updateDoc(doc(db, 'workspaces', workspaceId, collectionPath, todo.id), {
        completed: !todo.completed
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `workspaces/${workspaceId}/${collectionPath}/${todo.id}`);
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'workspaces', workspaceId, collectionPath, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `workspaces/${workspaceId}/${collectionPath}/${id}`);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <form onSubmit={addTodo} className="mb-6 relative">
        <input 
          type="text" 
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          placeholder={isPersonal ? "Your personal focus..." : "What's the next focus?"}
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

const FocusMode = ({ user, workspaceId, isMuted, onExit }: { user: User, workspaceId: string, isMuted: boolean, onExit: () => void }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center p-12 overflow-hidden"
    >
      <AbstractBackground />
      
      <button 
        onClick={onExit}
        className="absolute top-12 right-12 p-4 bg-white/5 rounded-2xl text-white/40 hover:text-white transition-all z-50 flex items-center gap-2 font-black uppercase tracking-widest text-xs border border-white/10"
      >
        <X size={20} /> Exit Focus
      </button>

      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-16 relative z-10">
        <div className="flex flex-col items-center justify-center">
          <Pomodoro user={user} workspaceId={workspaceId} isMuted={isMuted} />
        </div>
        <div className="bg-white/5 backdrop-blur-3xl rounded-[56px] p-12 border border-white/10 shadow-2xl flex flex-col">
          <h3 className="text-white font-black text-3xl mb-10 flex items-center gap-4">
            <Target size={32} className="text-indigo-500" /> Current Focus
          </h3>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
            <TodoList workspaceId={workspaceId} userId={user.uid} isMuted={isMuted} isPersonal={true} />
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-12 left-12 right-12 flex justify-between items-center z-10">
        <div className="flex items-center gap-4 bg-white/5 px-6 py-4 rounded-3xl border border-white/10">
          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-white/40 font-black text-xs uppercase tracking-widest">Deep Focus Active</span>
        </div>
        <div className="flex items-center gap-3">
          <Sparkles size={20} className="text-indigo-500 animate-spin-slow" />
          <p className="text-white/20 text-xs font-bold italic">"Focus is the art of saying no to everything else."</p>
        </div>
      </div>
    </motion.div>
  );
};
const TeamBoards = ({ workspaceId }: { workspaceId: string }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [userTodos, setUserTodos] = useState<Record<string, Todo[]>>({});
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('currentWorkspaceId', '==', workspaceId));
    return onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as User));
    });
  }, [workspaceId]);

  useEffect(() => {
    const unsubscribes = users.map(u => {
      const q = query(collection(db, 'workspaces', workspaceId, 'personalTodos'), where('createdBy', '==', u.uid));
      return onSnapshot(q, (snapshot) => {
        setUserTodos(prev => ({
          ...prev,
          [u.uid]: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Todo))
        }));
      });
    });
    return () => unsubscribes.forEach(unsub => unsub());
  }, [users, workspaceId]);

  useEffect(() => {
    // Fetch recent activities (sessions completed, tasks done)
    // For now, we'll simulate this by looking at todos and sessions if we had a global activity log
    // Let's just show a "Team Feed" of recent personal todos from everyone
    const allTodos: any[] = [];
    Object.entries(userTodos).forEach(([uid, todos]: [string, Todo[]]) => {
      const user = users.find(u => u.uid === uid);
      todos.forEach((t: Todo) => {
        allTodos.push({
          ...t,
          userName: user?.displayName || 'Anonymous',
          userPhoto: user?.photoURL
        });
      });
    });
    setActivities(allTodos.sort((a, b) => {
      const timeA = a.timestamp instanceof Timestamp ? a.timestamp.toMillis() : 0;
      const timeB = b.timestamp instanceof Timestamp ? b.timestamp.toMillis() : 0;
      return timeB - timeA;
    }).slice(0, 20));
  }, [userTodos, users]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-2">
      <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        {users.map((u) => (
          <motion.div 
            key={u.uid}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-[40px] p-8 flex flex-col gap-6 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <Activity size={48} className="text-indigo-500" />
            </div>
            <div className="flex items-center gap-4 relative z-10">
              <div className="relative">
                <img src={u.photoURL} className="w-14 h-14 rounded-2xl border-2 border-white/10" alt="" />
                <div className={cn(
                  "absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-slate-900",
                  u.status === 'focusing' ? "bg-red-500" : "bg-emerald-500"
                )} />
              </div>
              <div>
                <h4 className="text-white font-black tracking-tight">{u.displayName}</h4>
                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">
                  {u.status === 'focusing' ? `Focusing (${Math.floor((u.pomodoroTimeLeft || 0) / 60)}m)` : 'Flowing'}
                </p>
              </div>
            </div>

            <div className="flex-1 space-y-3 relative z-10">
              <h5 className="text-white/40 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <CheckSquare size={12} /> Personal Focus
              </h5>
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                {(userTodos[u.uid] || []).length === 0 ? (
                  <p className="text-white/20 text-xs italic">No active tasks...</p>
                ) : (
                  (userTodos[u.uid] || []).map(t => (
                    <div key={t.id} className={cn(
                      "p-3 rounded-xl text-xs font-bold flex items-center gap-3",
                      t.completed ? "bg-emerald-500/10 text-emerald-500/40" : "bg-white/5 text-white/60 border border-white/5"
                    )}>
                      <div className={cn("w-2 h-2 rounded-full", t.completed ? "bg-emerald-500/40" : "bg-indigo-500")} />
                      <span className="truncate">{t.text}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="lg:col-span-4 bg-white/5 border border-white/10 rounded-[40px] p-8 flex flex-col gap-8">
        <div>
          <h3 className="text-white font-black text-2xl tracking-tighter mb-2">Team <span className="text-indigo-500">Feed</span></h3>
          <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Recent activity across the space</p>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto custom-scrollbar pr-2">
          {activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Zap size={48} className="text-white/10 mb-4" />
              <p className="text-white/20 text-sm font-bold">No recent activity. Start focusing to see updates!</p>
            </div>
          ) : (
            activities.map((act, i) => (
              <div key={i} className="flex gap-4 group">
                <img src={act.userPhoto} className="w-10 h-10 rounded-xl border border-white/10" alt="" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-bold truncate">
                    <span className="text-indigo-400">{act.userName}</span>
                    <span className="text-white/40 ml-2">
                      {act.completed ? 'completed a task' : 'added a new focus'}
                    </span>
                  </p>
                  <p className="text-white/60 text-xs mt-1 font-medium italic truncate">"{act.text}"</p>
                  <p className="text-white/20 text-[8px] uppercase font-black tracking-widest mt-2">
                    {act.timestamp instanceof Timestamp ? format(act.timestamp.toDate(), 'HH:mm') : 'Just now'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
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
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-indigo-600/20 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-purple-600/20 blur-[150px] rounded-full animate-pulse delay-1000" />
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
  const [activeTab, setActiveTab] = useState<'flow' | 'team' | 'analytics'>('flow');
  const [isMuted, setIsMuted] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);

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
          lastActive: serverTimestamp() as any,
          totalFocusTime: 0,
          totalSessions: 0
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

          <nav className="space-y-4">
            <NavButton 
              active={activeTab === 'flow'} 
              onClick={() => setActiveTab('flow')} 
              icon={<LayoutDashboard size={20} />} 
              label="Flow Center" 
            />
            <NavButton 
              active={activeTab === 'team'} 
              onClick={() => setActiveTab('team')} 
              icon={<Layers size={20} />} 
              label="Team Boards" 
            />
            <NavButton 
              active={activeTab === 'analytics'} 
              onClick={() => setActiveTab('analytics')} 
              icon={<BarChart2 size={20} />} 
              label="Analytics" 
            />
          </nav>

          {user.status === 'focusing' && (
            <div className="mt-8 p-6 bg-indigo-500/10 rounded-[32px] border border-indigo-500/20 relative overflow-hidden group">
              <div className="absolute inset-0 bg-indigo-500/5 animate-pulse" />
              <div className="relative z-10 flex flex-col items-center text-center">
                <Timer size={24} className="text-indigo-400 mb-3 animate-bounce" />
                <p className="text-white font-black text-lg tracking-tighter">
                  {Math.floor((user.pomodoroTimeLeft || 0) / 60)}:
                  {String((user.pomodoroTimeLeft || 0) % 60).padStart(2, '0')}
                </p>
                <p className="text-indigo-400/60 text-[8px] font-black uppercase tracking-widest mt-1">Deep Focus Active</p>
              </div>
            </div>
          )}

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
          <AbstractBackground />

          <header className="flex flex-col md:flex-row md:items-center justify-between relative z-20 gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-indigo-500/30">
                  Live Workspace
                </span>
                <span className="text-white/20 text-xs font-bold">/</span>
                <span className="text-white/40 text-xs font-bold uppercase tracking-widest">
                  {activeTab === 'flow' ? 'Flow Center' : activeTab === 'team' ? 'Team Boards' : 'Analytics Dashboard'}
                </span>
              </div>
              <h1 className="text-5xl font-black text-white tracking-tighter leading-none">
                <span className="text-indigo-500">#</span> {currentWorkspace.name}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsFocusMode(true)}
                className="px-6 py-4 bg-indigo-500 text-white rounded-2xl font-black text-sm flex items-center gap-3 hover:bg-indigo-600 transition-all shadow-xl active:scale-95"
              >
                <Zap size={20} fill="currentColor" /> Start Focus Mode
              </button>
            </div>
          </header>

          <div className="flex-1 relative z-20 overflow-hidden">
            <AnimatePresence mode="wait">
              {activeTab === 'flow' && (
                <motion.div 
                  key="flow"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="h-full grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-hidden"
                >
                  <div className="lg:col-span-4 flex flex-col gap-8 overflow-y-auto custom-scrollbar pr-2">
                    <Pomodoro user={user} workspaceId={currentWorkspace.id} isMuted={isMuted} />
                    <GroupTimer workspace={currentWorkspace} isMuted={isMuted} />
                    <div className="flex-1 bg-white/5 backdrop-blur-3xl rounded-[40px] p-10 border border-white/10 shadow-2xl flex flex-col min-h-[400px]">
                      <h3 className="text-white font-black text-xl mb-8 flex items-center gap-3">
                        <Target size={24} className="text-indigo-500" /> Shared Tasks
                      </h3>
                      <TodoList workspaceId={currentWorkspace.id} userId={user.uid} isMuted={isMuted} />
                    </div>
                  </div>
                  <div className="lg:col-span-8 flex flex-col gap-8 overflow-hidden h-full">
                    <div className="flex-1">
                      <Chat workspaceId={currentWorkspace.id} user={user} isMuted={isMuted} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="bg-white/5 backdrop-blur-3xl rounded-[40px] p-8 border border-white/10 shadow-2xl h-80 flex flex-col">
                        <h3 className="text-white font-black text-xl mb-6 flex items-center gap-3">
                          <CheckSquare size={24} className="text-emerald-500" /> Your Personal Focus
                        </h3>
                        <TodoList workspaceId={currentWorkspace.id} userId={user.uid} isMuted={isMuted} isPersonal={true} />
                      </div>
                      <div className="bg-white/5 backdrop-blur-3xl rounded-[40px] p-8 border border-white/10 shadow-2xl h-80 overflow-y-auto custom-scrollbar">
                        <TeamFocus workspaceId={currentWorkspace.id} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'team' && (
                <motion.div 
                  key="team"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="h-full overflow-y-auto custom-scrollbar pr-4"
                >
                  <TeamBoards workspaceId={currentWorkspace.id} />
                </motion.div>
              )}

              {activeTab === 'analytics' && (
                <motion.div 
                  key="analytics"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="h-full overflow-y-auto custom-scrollbar pr-4"
                >
                  <Analytics user={user} workspaceId={currentWorkspace.id} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        <AnimatePresence>
          {isFocusMode && (
            <FocusMode 
              user={user} 
              workspaceId={currentWorkspace.id} 
              isMuted={isMuted} 
              onExit={() => setIsFocusMode(false)} 
            />
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}
