import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from 'expo-notifications';
import { APPWRITE, listDocuments, updateDocument, executeFunction, appwriteDatabases } from "@/lib/appwrite";

// ─── Constants ───────────────────────────────────────────────────────────────
const DATABASE_ID = APPWRITE.databaseId;
const TASKS_COL = "maintenance"; 
const PRINTERS_COL = "printers";
const USERS_COL = "users";

// ─── Types ────────────────────────────────────────────────────────────────────
export type Priority = number;
export type TaskStatus =
  | "Unassigned" | "Assigned" | "On the way" | "Fixing" | "Completed";
export type IssueType =
  | "Paper Jam" | "Offline" | "Ink Low" | "Paper Empty" | "Error Code"
  | "Connectivity Issue" | "Hardware Fault" | "Maintenance Due"
  | "Low Paper" | "No Paper";
export type TechnicianStatus = "Available" | "Busy" | "Offline";

export interface Technician {
  id: string; name: string; email: string; status: TechnicianStatus;
  avatar: string; tasksCompleted: number; avgResponseTime: number;
  successRate: number; currentTasks: string[]; phone: string;
}

export interface PrinterTask {
  id: string; printerId: string; location: string; issueType: IssueType;
  priority: number; status: TaskStatus; assignedTechnicianId: string | null;
  assignedTechnicianName: string | null; createdAt: Date; takenAt: Date | null;
  completedAt: Date | null; customerWaiting: boolean; notes?: string;
  building: string; floor: string; employee_one?: string;
}

export interface PrinterHealth {
  id: string; printerId: string; location: string; building: string;
  floor: string; status: "Online" | "Offline" | "Warning"; paperLevel: number;
  inkLevel: number; lastServiced: Date; model: string;
  assignedTechnicianId: string; assignedTechnicianName: string;
}

export interface CurrentUser {
  id: string; name: string; email: string;
  role: "Technician" | "Senior Technician";
}

interface AppContextType {
  currentUser: CurrentUser | null;
  isLoggedIn: boolean;
  tasks: PrinterTask[];
  technicians: Technician[];
  printers: PrinterHealth[];
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  takeTask: (taskId: string) => Promise<void>;
  refreshData: () => Promise<void>;
  bypassLogin: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

// ─── Mappers ──────────────────────────────────────────────────────────────────
const mapTask = (doc: any): PrinterTask => {
  const status: TaskStatus = doc.printerFixed ? "Completed" : (doc.employee_one ? "Assigned" : "Unassigned");
  return {
    id: doc.$id,
    printerId: doc.printer_id || "Unknown",
    location: doc.location || "Unknown",
    issueType: doc.error_type || "Issue",
    priority: Number(doc.priority) || 7,
    status,
    assignedTechnicianId: doc.employee_one || null,
    assignedTechnicianName: doc.employee_one || null,
    createdAt: new Date(doc.startTime || doc.$createdAt),
    takenAt: doc.takenAt ? new Date(doc.takenAt) : null,
    completedAt: doc.printerFixed ? new Date(doc.$updatedAt) : null,
    customerWaiting: Number(doc.priority) <= 2,
    building: doc.building || "-",
    floor: doc.floor || "-",
    employee_one: doc.employee_one,
  };
};

const mapPrinter = (doc: any): PrinterHealth => ({
  id: doc.$id,
  printerId: doc.name || doc.printer_id || doc.$id,
  location: doc.displayText || doc.location || "Unknown",
  building: doc.building || "-",
  floor: doc.floor || "-",
  status: doc.statusName === "Online" ? "Online" : doc.statusName === "Offline" ? "Offline" : "Warning",
  paperLevel: doc.paperLevel || 100,
  inkLevel: doc.inkLevel || 100,
  lastServiced: new Date(doc.$updatedAt),
  model: doc.vendor || "Standard",
  assignedTechnicianId: "",
  assignedTechnicianName: "",
  errorHistory: [], // FIXED: STOP CRASH
});

const mapTechnician = (doc: any): Technician => ({
  id: doc.$id,
  name: doc.name || "Unknown",
  email: doc.email || "",
  status: doc.status || "Offline",
  avatar: doc.name ? doc.name[0] : "?",
  tasksCompleted: 0,
  avgResponseTime: 0,
  successRate: 0,
  currentTasks: [],
  phone: doc.phone || ""
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [tasks, setTasks] = useState<PrinterTask[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [printers, setPrinters] = useState<PrinterHealth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionSecret, setSessionSecret] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const refreshData = async () => {
    try {
      setIsLoading(true);
      const session = await AsyncStorage.getItem("sessionSecret") || sessionSecret || undefined;

      // Tasks
      try {
        const tDocs = await listDocuments(TASKS_COL, session);
        setTasks(tDocs.map(mapTask));
      } catch (e) { console.error("Tasks fetch failed", e); }

      // Printers
      try {
        const pDocs = await listDocuments(PRINTERS_COL, session);
        setPrinters(pDocs.map(mapPrinter));
      } catch (e) { 
        console.error("Printers fetch failed", e);
        // Fallback or empty list
      }

      // Users
      try {
        const uDocs = await listDocuments(USERS_COL, session);
        setTechnicians(uDocs.map(mapTechnician));
      } catch (e) { }

    } finally {
      setIsLoading(false);
    }
  };

  const setupRealtime = () => {
    if (wsRef.current) wsRef.current.close();
    
    // Register the channel with sound - VERSION 2 to force update
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('priority_alerts_v2', {
        name: 'Priority Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'notification.wav', 
      });
    }

    const url = `wss://nyc.cloud.appwrite.io/v1/realtime?project=${APPWRITE.projectId}&channels[]=databases.${DATABASE_ID}.collections.${TASKS_COL}.documents&channels[]=databases.${DATABASE_ID}.collections.${PRINTERS_COL}.documents`;
    const ws = new WebSocket(url, [], { headers: { Origin: "http://localhost" } } as any);
    ws.onmessage = (e) => {
       const msg = JSON.parse(e.data);
       if (msg.type === "event") refreshData();
    };
    wsRef.current = ws;
  };

  useEffect(() => {
    const init = async () => {
      const stored = await AsyncStorage.getItem("currentUser");
      const secret = await AsyncStorage.getItem("sessionSecret");
      if (stored && secret) {
        setCurrentUser(JSON.parse(stored));
        setSessionSecret(secret);
        setIsLoggedIn(true);
      }
      await refreshData();
      setupRealtime();
    };
    init();
  }, []);

  const login = async (email: string, password: string) => {
    // Basic mock login for now - would normally call Appwrite
    const user: CurrentUser = { id: "user123", name: email.split('@')[0], email, role: "Technician" };
    setCurrentUser(user);
    setIsLoggedIn(true);
    await AsyncStorage.setItem("currentUser", JSON.stringify(user));
    await refreshData();
    return true;
  };

  const logout = () => {
    setCurrentUser(null);
    setIsLoggedIn(false);
    AsyncStorage.clear();
  };

  const takeTask = async (taskId: string) => {
    if (!currentUser) return;
    await appwriteDatabases.updateDocument(DATABASE_ID, TASKS_COL, taskId, {
      employee_one: currentUser.id,
      status: "In Progress",
      takenAt: new Date().toISOString()
    });
    await refreshData();
  };

  const bypassLogin = async () => {
    const user: CurrentUser = { id: "guest", name: "Guest", email: "guest@support.a4", role: "Senior Technician" };
    setCurrentUser(user);
    setIsLoggedIn(true);
    await refreshData();
  };

  return (
    <AppContext.Provider value={{ currentUser, isLoggedIn, tasks, technicians, printers, isLoading, login, logout, takeTask, refreshData, bypassLogin }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used in AppProvider");
  return ctx;
};
