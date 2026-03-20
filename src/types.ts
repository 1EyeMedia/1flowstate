import { Timestamp } from 'firebase/firestore';

export interface User {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  currentWorkspaceId?: string;
  lastActive: Timestamp | string;
  status: 'focusing' | 'resting' | 'chatting' | 'away';
  pomodoroTimeLeft?: number;
  isTimerRunning?: boolean;
  totalFocusTime?: number;
  totalSessions?: number;
}

export interface Workspace {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Timestamp | string;
  groupTimer?: {
    timeLeft: number;
    isRunning: boolean;
    lastUpdated: Timestamp | string;
  };
}

export interface FocusSession {
  id: string;
  userId: string;
  workspaceId: string;
  duration: number;
  timestamp: Timestamp | string;
  type: 'individual' | 'group';
  completedTasks?: string[];
}

export interface Message {
  id: string;
  workspaceId: string;
  senderId: string;
  senderName: string;
  text: string;
  imageUrl?: string;
  timestamp: Timestamp | string;
}

export interface Todo {
  id: string;
  workspaceId: string;
  text: string;
  completed: boolean;
  createdBy: string;
  timestamp: Timestamp | string;
}
