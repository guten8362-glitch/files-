import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { APPWRITE, listDocuments, updateDocument } from "@/lib/appwrite";

// ─── Types ────────────────────────────────────────────────────────────────────
export type Priority = "High" | "Medium" | "Low";
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
  priority: Priority; status: TaskStatus; assignedTechnicianId: string | null;
  assignedTechnicianName: string | null; createdAt: Date; takenAt: Date | null;
  completedAt: Date | null; customerWaiting: boolean; notes?: string;
  building: string; floor: string;
}

export interface PrinterHealth {
  id: string; printerId: string; location: string; building: string;
  floor: string; status: "Online" | "Offline" | "Warning"; paperLevel: number;
  inkLevel: number; lastServiced: Date; model: string;
  assignedTechnicianId: string; assignedTechnicianName: string;
  errorHistory: { date: Date; error: string; resolvedBy: string }[];
  shopName: string; ownerName: string; ownerPhone: string;
  maxPaperCapacity: number; printedCount: number;
  latitude: number; longitude: number; shopImage: string;
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
  takeTask: (taskId: string) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  completeTask: (taskId: string, notes?: string) => void;
  requestAssistance: (taskId: string) => void;
  addPrinter: (
    printer: Omit<PrinterHealth, "id" | "errorHistory" | "status" | "paperLevel" | "lastServiced">
  ) => void;
  refreshData: () => Promise<void>;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────
const mapTechnician = (doc: any): Technician => ({
  id: doc.$id,
  name: doc.name || "Unknown Technician",
  email: doc.email || "",
  status: (doc.status as TechnicianStatus) || "Offline",
  avatar: doc.avatar || (doc.name ? doc.name.split(" ").map((n: string) => n[0]).join("") : "??"),
  tasksCompleted: doc.tasksCompleted || 0,
  avgResponseTime: doc.avgResponseTime || 0,
  successRate: doc.successRate || 0,
  currentTasks: Array.isArray(doc.currentTasks) ? doc.currentTasks : [],
  phone: doc.phone || "",
});

// ─── Mappers ──────────────────────────────────────────────────────────────────
const mapTask = (doc: any): PrinterTask => {
  const issues: string[]   = Array.isArray(doc.issues) ? doc.issues : [];
  const firstIssue         = (issues[0] ?? "Paper Jam") as IssueType;
  const priority: Priority =
    doc.priority === "HIGH" ? "High" : doc.priority === "MEDIUM" ? "Medium" : "Low";
  const status: TaskStatus =
    doc.status === "DONE"           ? "Completed"  :
    doc.employeeId?.length > 0      ? "Assigned"   : "Unassigned";

  return {
    id: doc.$id,
    printerId:              doc.printerId || "Unknown",
    location:               doc.location  || doc.printerId || "Unknown",
    building:               doc.building  || "-",
    floor:                  doc.floor     || "-",
    issueType:              firstIssue,
    priority,
    status,
    assignedTechnicianId:   doc.employeeId || null,
    assignedTechnicianName: doc.employeeId ? "Technician" : null,
    createdAt:   doc.createdAt   ? new Date(doc.createdAt)  : new Date(doc.$createdAt),
    takenAt:     doc.takenAt     ? new Date(doc.takenAt)    : null,
    completedAt: doc.status === "DONE" ? new Date(doc.$updatedAt) : null,
    customerWaiting: doc.priority === "HIGH",
    notes: doc.notes || "",
  };
};

const mapPrinter = (doc: any): PrinterHealth => {
  const capacity   = doc.capacity ?? 500;
  const curPaper   = doc.currentPaper ?? capacity;
  const paperLevel = Math.max(0, Math.round((curPaper / capacity) * 100));

  return {
    id:         doc.$id,
    printerId:  doc.name || doc.printerId || doc.$id,
    location:   doc.location || "Unknown",
    building:   doc.building || "-",
    floor:      doc.floor    || "-",
    status:
      doc.status === "Online"  ? "Online"  :
      doc.status === "Offline" ? "Offline" : "Warning",
    paperLevel,
    inkLevel:   doc.inkLevel ?? 100,
    lastServiced: doc.lastUpdated
      ? new Date(doc.lastUpdated) : new Date(doc.$updatedAt),
    model: doc.model || "Standard Printer",
    assignedTechnicianId:   doc.assignedTechnicianId   || "",
    assignedTechnicianName: doc.assignedTechnicianName || "",
    shopName:    doc.shopName  || doc.name || "Print Shop",
    ownerName:   doc.ownerName  || "-",
    ownerPhone:  doc.ownerPhone || "-",
    maxPaperCapacity: capacity,
    printedCount:     doc.dailyPrinted || 0,
    latitude:  doc.latitude  ?? 0,
    longitude: doc.longitude ?? 0,
    shopImage: doc.shopImage ||
      "https://images.unsplash.com/photo-1544256718-3bcf237f3974?auto=format&fit=crop&q=80&w=400",
    errorHistory: [],
  };
};

// ─── Context ──────────────────────────────────────────────────────────────────
const AppContext = createContext<AppContextType | null>(null);

const PRIORITY_WEIGHT: Record<string, number> = { High: 3, Medium: 2, Low: 1 };

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoggedIn,  setIsLoggedIn]  = useState(false);
  const [tasks,       setTasks]       = useState<PrinterTask[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [printers,    setPrinters]    = useState<PrinterHealth[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch live data ────────────────────────────────────────────────────────
  const refreshData = async () => {
    try {
      // Tasks
      const taskDocs = await listDocuments("tasks_collection");
      console.log("[AppContext] tasks fetched:", taskDocs.length);
      const rawTasks = taskDocs.map(mapTask);
      rawTasks.sort((a, b) =>
        PRIORITY_WEIGHT[b.priority] !== PRIORITY_WEIGHT[a.priority]
          ? PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]
          : a.createdAt.getTime() - b.createdAt.getTime()
      );
      setTasks(rawTasks);

      // 2. Printers
      const pDocs = await listDocuments("printers");
      console.log("[AppContext] printers fetched:", pDocs.length);
      setPrinters(pDocs.map(mapPrinter));

      // 3. Technicians (Users)
      const uDocs = await listDocuments("users_collection");
      console.log("[AppContext] technicians fetched:", uDocs.length);
      setTechnicians(uDocs.map(mapTechnician));
    } catch (err) {
      console.error("[AppContext] refreshData error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Poll every 15 s as a lightweight realtime substitute ─────────────────
  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(refreshData, 15_000);
  };

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const stored = await AsyncStorage.getItem("currentUser");
        if (stored) {
          setCurrentUser(JSON.parse(stored));
          setIsLoggedIn(true);
        }
      } catch {}
      await refreshData();
      startPolling();
    };
    init();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const login = async (email: string, password: string): Promise<boolean> => {
    // Check against fetched technicians from users_collection
    const tech = technicians.find(
      t => t.email.toLowerCase() === email.toLowerCase()
    );
    
    // For now, allow 'tech123' or 'admin123' as password if tech exists
    // (In production, use Appwrite Auth proper)
    if (tech && (password === "tech123" || password === "admin123")) {
      const user: CurrentUser = { 
        id: tech.id, 
        name: tech.name, 
        email: tech.email, 
        role: tech.email.includes("admin") ? "Senior Technician" : "Technician" 
      };
      setCurrentUser(user);
      setIsLoggedIn(true);
      await AsyncStorage.setItem("currentUser", JSON.stringify(user));
      return true;
    }
    return false;
  };

  const logout = async () => {
    setCurrentUser(null);
    setIsLoggedIn(false);
    await AsyncStorage.removeItem("currentUser");
  };

  // ── Task mutations ─────────────────────────────────────────────────────────
  const takeTask = async (taskId: string) => {
    if (!currentUser) return;
    setTasks(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, status: "Assigned", assignedTechnicianId: currentUser.id,
            assignedTechnicianName: currentUser.name, takenAt: new Date() }
        : t
    ));
    try {
      await updateDocument("tasks_collection", taskId, { employeeId: currentUser.id });
    } catch (e) {
      console.error("[takeTask] failed:", e);
      refreshData();
    }
  };

  const updateTaskStatus = (taskId: string, status: TaskStatus) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
  };

  const completeTask = async (taskId: string, notes?: string) => {
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: "Completed", completedAt: new Date(), notes } : t
    ));
    try {
      await updateDocument("tasks_collection", taskId, { status: "DONE", notes: notes ?? "" });
    } catch (e) {
      console.error("[completeTask] failed:", e);
      refreshData();
    }
  };

  const requestAssistance = (_taskId: string) => {};

  // ── Printer mutations ──────────────────────────────────────────────────────
  const addPrinter = (
    printerData: Omit<PrinterHealth, "id" | "errorHistory" | "status" | "paperLevel" | "lastServiced">
  ) => {
    const remaining  = printerData.maxPaperCapacity - printerData.printedCount;
    const paperLevel = Math.max(0, Math.round((remaining / printerData.maxPaperCapacity) * 100));
    const newPrinter: PrinterHealth = {
      ...printerData,
      id: "p" + Date.now(),
      status: paperLevel === 0 ? "Warning" : "Online",
      paperLevel,
      lastServiced: new Date(),
      errorHistory: [],
    };
    setPrinters(prev => [newPrinter, ...prev]);
    if (paperLevel <= 15) {
      const isZero = paperLevel === 0;
      setTasks(prev => [{
        id:                     "t_" + Date.now(),
        printerId:              newPrinter.printerId,
        location:               newPrinter.location,
        issueType:              isZero ? "No Paper" : "Low Paper",
        priority:               isZero ? "High" : "Medium",
        status:                 "Unassigned",
        assignedTechnicianId:   null,
        assignedTechnicianName: null,
        createdAt:              new Date(),
        takenAt:                null,
        completedAt:            null,
        customerWaiting:        isZero,
        building:               newPrinter.building,
        floor:                  newPrinter.floor,
      }, ...prev]);
    }
  };

  return (
    <AppContext.Provider value={{
      currentUser, isLoggedIn, tasks, technicians, printers, isLoading,
      login, logout, takeTask, updateTaskStatus, completeTask,
      requestAssistance, addPrinter, refreshData,
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
