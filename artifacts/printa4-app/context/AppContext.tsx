import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export type Priority = "High" | "Medium" | "Low";
export type TaskStatus = "Unassigned" | "Assigned" | "On the way" | "Fixing" | "Completed";
export type IssueType = "Paper Jam" | "Offline" | "Paper Empty" | "Error Code" | "Connectivity Issue" | "Hardware Fault" | "Maintenance Due" | "Low Paper" | "No Paper";
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
  paperLevel: number;
  lastServiced: Date;
  model: string;
  assignedTechnicianId: string;
  assignedTechnicianName: string;
  errorHistory: { date: Date; error: string; resolvedBy: string }[];
  shopName: string;
  ownerName: string;
  ownerPhone: string;
  maxPaperCapacity: number;
  printedCount: number;
  latitude: number;
  longitude: number;
  shopImage: string;
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
  addPrinter: (printer: Omit<PrinterHealth, "id" | "errorHistory" | "status" | "paperLevel" | "lastServiced">) => void;
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
    paperLevel: 0,
    lastServiced: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    model: "HP LaserJet Pro M404n",
    assignedTechnicianId: "t1",
    assignedTechnicianName: "Arjun Sharma",
    shopName: "Central Lib Kiosk",
    ownerName: "Dr. Ramesh",
    ownerPhone: "+91 9988776655",
    maxPaperCapacity: 500,
    printedCount: 500,
    latitude: 12.9716,
    longitude: 77.5946,
    shopImage: "https://images.unsplash.com/photo-1544256718-3bcf237f3974?auto=format&fit=crop&q=80&w=400",
    errorHistory: [
      { date: new Date(Date.now() - 25 * 60 * 1000), error: "No Paper", resolvedBy: "Arjun Sharma" },
      { date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), error: "Low Paper", resolvedBy: "Priya Nair" },
    ],
  },
  {
    id: "p2",
    printerId: "PRN-205",
    location: "Admin Block - Office",
    building: "Admin Block",
    floor: "Ground Floor",
    status: "Offline",
    paperLevel: 80,
    lastServiced: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    model: "Canon imageRUNNER 2425",
    assignedTechnicianId: "t3",
    assignedTechnicianName: "Ravi Kumar",
    shopName: "Admin FastPrint",
    ownerName: "Admin Office",
    ownerPhone: "+91 8877665544",
    maxPaperCapacity: 1000,
    printedCount: 200,
    latitude: 12.9720,
    longitude: 77.5950,
    shopImage: "https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&q=80&w=400",
    errorHistory: [
      { date: new Date(Date.now() - 45 * 60 * 1000), error: "Device Offline - Network Error", resolvedBy: "" },
    ],
  },
  {
    id: "p3",
    printerId: "PRN-312",
    location: "Science Block - Lab 3",
    building: "Science Block",
    floor: "3rd Floor",
    status: "Online",
    paperLevel: 70,
    lastServiced: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
    model: "Epson EcoTank L3250",
    assignedTechnicianId: "t1",
    assignedTechnicianName: "Arjun Sharma",
    shopName: "Sci-Lab Printers",
    ownerName: "Prof. Anika",
    ownerPhone: "+91 9123456780",
    maxPaperCapacity: 250,
    printedCount: 75,
    latitude: 12.9710,
    longitude: 77.5940,
    shopImage: "https://images.unsplash.com/photo-1560205001-a7fedfbfa4d7?auto=format&fit=crop&q=80&w=400",
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
  const [printers, setPrinters] = useState<PrinterHealth[]>(MOCK_PRINTERS);

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
        // Find the printer for this task to check its assignment
        const printer = printers.find(p => p.printerId === t.printerId);
        const isAssignedToMe = printer?.assignedTechnicianId === currentUser.id;
        const isSeniorTech = currentUser.role === "Senior Technician";

        if (isAssignedToMe || isSeniorTech) {
          return {
            ...t,
            status: "Assigned" as TaskStatus,
            assignedTechnicianId: currentUser.id,
            assignedTechnicianName: currentUser.name,
            takenAt: new Date(),
          };
        }
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

  const addPrinter = (printerData: Omit<PrinterHealth, "id" | "errorHistory" | "status" | "paperLevel" | "lastServiced">) => {
    // Math Logic for initial paperLevel
    const remaining = printerData.maxPaperCapacity - printerData.printedCount;
    const initialPaperLevel = Math.max(0, Math.round((remaining / printerData.maxPaperCapacity) * 100));

    const newPrinter: PrinterHealth = {
      ...printerData,
      id: "p" + Date.now(),
      status: initialPaperLevel === 0 ? "Warning" : "Online",
      paperLevel: initialPaperLevel,
      lastServiced: new Date(),
      errorHistory: [],
    };
    
    setPrinters(prev => [newPrinter, ...prev]);

    // Automated Task Generation based on the mathematical threshold:
    if (initialPaperLevel <= 15) {
      const isZero = initialPaperLevel === 0;
      setTasks(prev => [{
        id: "t_" + Date.now(),
        printerId: newPrinter.printerId,
        location: newPrinter.location,
        issueType: isZero ? "No Paper" : "Low Paper",
        priority: isZero ? "High" : "Medium",
        status: "Unassigned",
        assignedTechnicianId: null, // Follow assignment rules
        assignedTechnicianName: null,
        createdAt: new Date(),
        takenAt: null,
        completedAt: null,
        customerWaiting: isZero,
        building: newPrinter.building,
        floor: newPrinter.floor,
      }, ...prev]);
    }
  };

  return (
    <AppContext.Provider value={{
      currentUser, isLoggedIn, tasks, technicians, printers,
      login, logout, takeTask, updateTaskStatus, completeTask, requestAssistance, addPrinter
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
