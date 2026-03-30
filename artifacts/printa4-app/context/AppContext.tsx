import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export type Priority = "High" | "Medium" | "Low";
export type TaskStatus = "Unassigned" | "Assigned" | "On the way" | "Fixing" | "Completed";
export type IssueType = "Paper Jam" | "Offline" | "Ink Low" | "Paper Empty" | "Error Code" | "Connectivity Issue" | "Hardware Fault" | "Maintenance Due";
export type TechnicianStatus = "Available" | "Busy" | "Offline";

export interface Technician {
  id: string;
  name: string;
  email: string;
  status: TechnicianStatus;
  avatar: string;
  tasksCompleted: number;
  avgResponseTime: number;
  successRate: number;
  currentTasks: string[];
  phone: string;
}

export interface PrinterTask {
  id: string;
  printerId: string;
  location: string;
  issueType: IssueType;
  priority: Priority;
  status: TaskStatus;
  assignedTechnicianId: string | null;
  assignedTechnicianName: string | null;
  createdAt: Date;
  takenAt: Date | null;
  completedAt: Date | null;
  customerWaiting: boolean;
  notes?: string;
  building: string;
  floor: string;
}

export interface PrinterHealth {
  id: string;
  printerId: string;
  location: string;
  building: string;
  floor: string;
  status: "Online" | "Offline" | "Warning";
  inkLevel: number;
  paperLevel: number;
  lastServiced: Date;
  model: string;
  errorHistory: { date: Date; error: string; resolvedBy: string }[];
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: "Technician" | "Senior Technician";
}

interface AppContextType {
  currentUser: CurrentUser | null;
  isLoggedIn: boolean;
  tasks: PrinterTask[];
  technicians: Technician[];
  printers: PrinterHealth[];
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  takeTask: (taskId: string) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  completeTask: (taskId: string, notes?: string) => void;
  requestAssistance: (taskId: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

const MOCK_TECHNICIANS: Technician[] = [
  {
    id: "t1",
    name: "Arjun Sharma",
    email: "arjun.sharma@college.edu",
    status: "Busy",
    avatar: "AS",
    tasksCompleted: 47,
    avgResponseTime: 12,
    successRate: 96,
    currentTasks: ["task1", "task3"],
    phone: "+91 98765 43210",
  },
  {
    id: "t2",
    name: "Priya Nair",
    email: "priya.nair@college.edu",
    status: "Available",
    avatar: "PN",
    tasksCompleted: 63,
    avgResponseTime: 8,
    successRate: 99,
    currentTasks: [],
    phone: "+91 87654 32109",
  },
  {
    id: "t3",
    name: "Ravi Kumar",
    email: "ravi.kumar@college.edu",
    status: "Busy",
    avatar: "RK",
    tasksCompleted: 31,
    avgResponseTime: 15,
    successRate: 94,
    currentTasks: ["task2"],
    phone: "+91 76543 21098",
  },
  {
    id: "t4",
    name: "Meena Iyer",
    email: "meena.iyer@college.edu",
    status: "Offline",
    avatar: "MI",
    tasksCompleted: 28,
    avgResponseTime: 18,
    successRate: 91,
    currentTasks: [],
    phone: "+91 65432 10987",
  },
  {
    id: "t5",
    name: "Deepak Patel",
    email: "deepak.patel@college.edu",
    status: "Available",
    avatar: "DP",
    tasksCompleted: 52,
    avgResponseTime: 10,
    successRate: 97,
    currentTasks: [],
    phone: "+91 54321 09876",
  },
];

const MOCK_TASKS: PrinterTask[] = [
  {
    id: "task1",
    printerId: "PRN-101",
    location: "Library - Floor 2",
    building: "Central Library",
    floor: "2nd Floor",
    issueType: "Paper Jam",
    priority: "High",
    status: "Assigned",
    assignedTechnicianId: "t1",
    assignedTechnicianName: "Arjun Sharma",
    createdAt: new Date(Date.now() - 25 * 60 * 1000),
    takenAt: new Date(Date.now() - 20 * 60 * 1000),
    completedAt: null,
    customerWaiting: true,
  },
  {
    id: "task2",
    printerId: "PRN-205",
    location: "Admin Block - Office",
    building: "Admin Block",
    floor: "Ground Floor",
    issueType: "Offline",
    priority: "High",
    status: "Fixing",
    assignedTechnicianId: "t3",
    assignedTechnicianName: "Ravi Kumar",
    createdAt: new Date(Date.now() - 45 * 60 * 1000),
    takenAt: new Date(Date.now() - 40 * 60 * 1000),
    completedAt: null,
    customerWaiting: true,
  },
  {
    id: "task3",
    printerId: "PRN-312",
    location: "Science Block - Lab 3",
    building: "Science Block",
    floor: "3rd Floor",
    issueType: "Ink Low",
    priority: "Medium",
    status: "On the way",
    assignedTechnicianId: "t1",
    assignedTechnicianName: "Arjun Sharma",
    createdAt: new Date(Date.now() - 15 * 60 * 1000),
    takenAt: new Date(Date.now() - 10 * 60 * 1000),
    completedAt: null,
    customerWaiting: false,
  },
  {
    id: "task4",
    printerId: "PRN-418",
    location: "Commerce Dept - Staff Room",
    building: "Commerce Block",
    floor: "1st Floor",
    issueType: "Paper Empty",
    priority: "Low",
    status: "Unassigned",
    assignedTechnicianId: null,
    assignedTechnicianName: null,
    createdAt: new Date(Date.now() - 5 * 60 * 1000),
    takenAt: null,
    completedAt: null,
    customerWaiting: false,
  },
  {
    id: "task5",
    printerId: "PRN-523",
    location: "Engineering - Room 502",
    building: "Engineering Block",
    floor: "5th Floor",
    issueType: "Error Code",
    priority: "High",
    status: "Unassigned",
    assignedTechnicianId: null,
    assignedTechnicianName: null,
    createdAt: new Date(Date.now() - 2 * 60 * 1000),
    takenAt: null,
    completedAt: null,
    customerWaiting: true,
  },
  {
    id: "task6",
    printerId: "PRN-607",
    location: "Canteen - Notice Board",
    building: "Canteen",
    floor: "Ground Floor",
    issueType: "Connectivity Issue",
    priority: "Medium",
    status: "Unassigned",
    assignedTechnicianId: null,
    assignedTechnicianName: null,
    createdAt: new Date(Date.now() - 30 * 60 * 1000),
    takenAt: null,
    completedAt: null,
    customerWaiting: false,
  },
];

const MOCK_PRINTERS: PrinterHealth[] = [
  {
    id: "p1",
    printerId: "PRN-101",
    location: "Library - Floor 2",
    building: "Central Library",
    floor: "2nd Floor",
    status: "Warning",
    inkLevel: 15,
    paperLevel: 0,
    lastServiced: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    model: "HP LaserJet Pro M404n",
    errorHistory: [
      { date: new Date(Date.now() - 25 * 60 * 1000), error: "Paper Jam - Tray 1", resolvedBy: "Arjun Sharma" },
      { date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), error: "Ink Low Warning", resolvedBy: "Priya Nair" },
      { date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), error: "Scheduled Maintenance", resolvedBy: "Ravi Kumar" },
    ],
  },
  {
    id: "p2",
    printerId: "PRN-205",
    location: "Admin Block - Office",
    building: "Admin Block",
    floor: "Ground Floor",
    status: "Offline",
    inkLevel: 60,
    paperLevel: 80,
    lastServiced: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    model: "Canon imageRUNNER 2425",
    errorHistory: [
      { date: new Date(Date.now() - 45 * 60 * 1000), error: "Device Offline - Network Error", resolvedBy: "" },
      { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), error: "Toner Replaced", resolvedBy: "Meena Iyer" },
    ],
  },
  {
    id: "p3",
    printerId: "PRN-312",
    location: "Science Block - Lab 3",
    building: "Science Block",
    floor: "3rd Floor",
    status: "Online",
    inkLevel: 35,
    paperLevel: 70,
    lastServiced: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
    model: "Epson EcoTank L3250",
    errorHistory: [
      { date: new Date(Date.now() - 15 * 60 * 1000), error: "Ink Low - Cyan Cartridge", resolvedBy: "" },
    ],
  },
];

const MOCK_USERS = [
  { id: "u1", email: "arjun.sharma@college.edu", password: "tech123", name: "Arjun Sharma", role: "Technician" as const },
  { id: "u2", email: "priya.nair@college.edu", password: "tech123", name: "Priya Nair", role: "Senior Technician" as const },
  { id: "admin", email: "admin@college.edu", password: "admin123", name: "Admin User", role: "Senior Technician" as const },
];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [tasks, setTasks] = useState<PrinterTask[]>(MOCK_TASKS);
  const [technicians] = useState<Technician[]>(MOCK_TECHNICIANS);
  const [printers] = useState<PrinterHealth[]>(MOCK_PRINTERS);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const stored = await AsyncStorage.getItem("currentUser");
        if (stored) {
          const user = JSON.parse(stored);
          setCurrentUser(user);
          setIsLoggedIn(true);
        }
      } catch {}
    };
    loadUser();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const user = MOCK_USERS.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (user) {
      const current: CurrentUser = { id: user.id, name: user.name, email: user.email, role: user.role };
      setCurrentUser(current);
      setIsLoggedIn(true);
      await AsyncStorage.setItem("currentUser", JSON.stringify(current));
      return true;
    }
    return false;
  };

  const logout = async () => {
    setCurrentUser(null);
    setIsLoggedIn(false);
    await AsyncStorage.removeItem("currentUser");
  };

  const takeTask = (taskId: string) => {
    if (!currentUser) return;
    setTasks(prev => prev.map(t => {
      if (t.id === taskId && !t.assignedTechnicianId) {
        return {
          ...t,
          status: "Assigned" as TaskStatus,
          assignedTechnicianId: currentUser.id,
          assignedTechnicianName: currentUser.name,
          takenAt: new Date(),
        };
      }
      return t;
    }));
  };

  const updateTaskStatus = (taskId: string, status: TaskStatus) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
  };

  const completeTask = (taskId: string, notes?: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return { ...t, status: "Completed" as TaskStatus, completedAt: new Date(), notes };
      }
      return t;
    }));
  };

  const requestAssistance = (_taskId: string) => {};

  return (
    <AppContext.Provider value={{
      currentUser, isLoggedIn, tasks, technicians, printers,
      login, logout, takeTask, updateTaskStatus, completeTask, requestAssistance,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
