import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { registerNotificationChannels, configureNotificationHandler, playNotificationSound, getPushToken } from '@/lib/notifications';
import { APPWRITE, listDocuments, updateDocument, executeFunction, createSession } from "@/lib/appwrite";

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
  id: string; printerId: string; printerName: string; location: string; issueType: IssueType;
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
// ─── Priority from Issue Type ────────────────────────────────────────────────
/**
 * Auto-derive priority from the error type when the DB field is missing/0.
 * P1 = most urgent, P7 = least urgent.
 */
const ISSUE_PRIORITY_MAP: Record<string, number> = {
  // P1 — Critical: No paper at all, printer completely unusable
  "No Paper":           1,
  "No paper":           1,
  "Paper Empty":        1,
  // P2 — Critical: Someone asked for service
  "Service Requested":  2,
  // P3 — Warning: Paper jam blocks all printing
  "Paper Jam":          3,
  "Jammed":             3,
  // P4 — Warning: Door left open
  "Door Opened":        4,
  // P5 — Info: Toner running out (still works, not urgent)
  "No toner ink":       5,
  "Low toner ink":      5,
  "Ink Low":            5,
  // P6 — Info: Printer offline / connectivity
  "Printer Offline":    6,
  "Offline":            6,
  "Connectivity Issue": 6,
  // P7 — Low: Low paper (still working, just a warning)
  "Low Paper":          7,
  "Low paper":          7,
};

function derivePriority(errorType: string, dbPriority: any): number {
  // If Appwrite has a valid numeric priority (1–7), use it
  const num = Number(dbPriority);
  if (num >= 1 && num <= 7) return num;
  // Otherwise derive from the issue type
  return ISSUE_PRIORITY_MAP[errorType] ?? 7;
}


const mapTask = (doc: any, printerDocs: any[] = []): PrinterTask => {
  const status: TaskStatus = doc.printerFixed ? "Completed" : (doc.employee_one ? "Assigned" : "Unassigned");
  const printerId = doc.printer_id || "Unknown";
  // Look up the printer name from the printers collection
  const matchedPrinter = printerDocs.find(
    (p) => p.$id === printerId || p.printer_id === printerId
  );
  const printerName = matchedPrinter?.name || printerId;
  return {
    id: doc.$id,
    printerId,
    printerName,
    location: doc.location || "Unknown",
    issueType: doc.error_type || "Issue",
    priority: derivePriority(doc.error_type || "", doc.priority),
    status,
    assignedTechnicianId: doc.employee_one || null,
    assignedTechnicianName: doc.employee_one || null,
    createdAt: new Date(doc.startTime || doc.$createdAt),
    takenAt: doc.employee_one ? new Date(doc.$updatedAt) : null,
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

const mapTechnician = (doc: any): Technician => {
  // users collection has no 'name' field — derive display name from email
  const rawName =
    doc.name ||
    (doc.email
      ? doc.email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
      : "Unknown");
  return {
    id: doc.$id,
    name: rawName,
    email: doc.email || "",
    status: doc.status || "Available",
    avatar: rawName[0] || "?",
    tasksCompleted: 0,
    avgResponseTime: 0,
    successRate: 0,
    currentTasks: [],
    phone: doc.phone || "",
  };
};

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

      // Fetch printers first so tasks can resolve printer names
      let pDocs: any[] = [];
      try {
        pDocs = await listDocuments(PRINTERS_COL, session);
        setPrinters(pDocs.map(mapPrinter));
      } catch (e) { 
        console.error("Printers fetch failed", e);
      }

      // Tasks — pass printer docs so names can be resolved
      try {
        const tDocs = await listDocuments(TASKS_COL, session);
        setTasks(tDocs.map((doc) => mapTask(doc, pDocs)));
      } catch (e) { console.error("Tasks fetch failed", e); }

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

    // Set up foreground notification display behaviour
    configureNotificationHandler();

    // Register Android notification channels with custom sound
    registerNotificationChannels();

    const url = `wss://nyc.cloud.appwrite.io/v1/realtime?project=${APPWRITE.projectId}&channels[]=databases.${DATABASE_ID}.collections.${TASKS_COL}.documents&channels[]=databases.${DATABASE_ID}.collections.${PRINTERS_COL}.documents`;
    const ws = new WebSocket(url, [], { headers: { Origin: "http://localhost" } } as any);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "event") {
        // Play custom sound when a new task/printer event arrives while app is open
        playNotificationSound();
        refreshData();
      }
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
      // Request notification permission and get push token
      getPushToken().then(token => {
        if (token) console.log('[AppContext] Push token ready:', token);
      });
    };
    init();
  }, []);

  const login = async (email: string, password: string) => {
    // Step 1: Create a real Appwrite session
    const session = await createSession(email, password);
    const secret = session.secret || session.$id;
    setSessionSecret(secret);
    await AsyncStorage.setItem("sessionSecret", secret);

    // Step 2: Fetch all users and find this user's record by email
    let matchedUser: CurrentUser | null = null;
    try {
      const uDocs = await listDocuments(USERS_COL, secret);
      const found = uDocs.find(
        (doc: any) => (doc.email || "").toLowerCase() === email.toLowerCase()
      );
      if (found) {
        const derivedName = found.name ||
          (found.email || email).split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
        matchedUser = {
          id: found.$id,              // Real Appwrite document ID
          name: derivedName,
          email: found.email || email,
          role: (found.role === "Senior Technician" ? "Senior Technician" : "Technician"),
        };
      }
    } catch (e) {
      console.warn("Could not look up user in users collection", e);
    }

    // Fallback if user doc not found
    if (!matchedUser) {
      matchedUser = {
        id: email,             // Use email as ID fallback
        name: email.split("@")[0],
        email,
        role: "Technician",
      };
    }

    setCurrentUser(matchedUser);
    setIsLoggedIn(true);
    await AsyncStorage.setItem("currentUser", JSON.stringify(matchedUser));
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
    const session = await AsyncStorage.getItem("sessionSecret") || sessionSecret || undefined;
    console.log(`[TakeTask] Assigning task ${taskId} to ${currentUser.name} (${currentUser.id})`);
    try {
      await updateDocument(TASKS_COL, taskId, {
        employee_one: currentUser.id,
      }, session);
      console.log(`[TakeTask] ✅ Success — employee_one = ${currentUser.id}`);
    } catch (e: any) {
      console.error(`[TakeTask] ❌ Failed:`, e.message);
      throw e; // re-throw so TaskCard shows error state
    }
    await refreshData();
  };

  const bypassLogin = async () => {
    // Try to pick a real user from the DB so Take Task works with a valid ID
    let user: CurrentUser = { id: "guest", name: "Guest", email: "guest@support.a4", role: "Senior Technician" };
    try {
      const uDocs = await listDocuments(USERS_COL);
      if (uDocs.length > 0) {
        const first = uDocs[0];
        const derivedName = first.name ||
          (first.email || "guest").split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
        user = {
          id: first.$id,
          name: derivedName,
          email: first.email || "guest@support.a4",
          role: "Senior Technician",
        };
        console.log(`[BypassLogin] Using real user: ${user.name} (${user.id})`);
      }
    } catch (e) {
      console.warn("[BypassLogin] Could not fetch users, using guest fallback", e);
    }
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
