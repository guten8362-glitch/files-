import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { APPWRITE, listDocuments, updateDocument, executeFunction, client } from "@/lib/appwrite";

// ─── Types ────────────────────────────────────────────────────────────────────
/** Numeric priority rank: 1 (highest urgency) → 7 (lowest / initializing) */
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
  fcmToken?: string[];
}

export interface PrinterTask {
  id: string; printerId: string; location: string; issueType: IssueType;
  /** Numeric priority rank 1-7. Lower = more urgent. Defaults to 7 while backend calculates. */
  priority: number; status: TaskStatus; assignedTechnicianId: string | null;
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
  updatePrinter: (id: string, data: Partial<PrinterHealth>) => void;
  refreshData: () => Promise<void>;
  bypassLogin: () => Promise<void>;
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
  fcmToken: Array.isArray(doc.fcmToken) ? doc.fcmToken : [],
});

// ─── Mappers ──────────────────────────────────────────────────────────────────
const mapTask = (doc: any): PrinterTask => {
  const issues: string[] = Array.isArray(doc.issues) ? doc.issues : [];
  const firstIssue       = (issues[0] ?? "Paper Jam") as IssueType;

  // Backend sends numeric rank 1-7. Default to 7 (lowest) while computing.
  const rawPriority = Number(doc.priority);
  const priority: number = (!isNaN(rawPriority) && rawPriority >= 1 && rawPriority <= 7)
    ? rawPriority
    : 7;

  const status: TaskStatus =
    doc.status === "DONE"        ? "Completed"  :
    doc.employeeId?.length > 0  ? "Assigned"   : "Unassigned";

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
    createdAt:   doc.createdAt ? new Date(doc.createdAt)  : new Date(doc.$createdAt),
    takenAt:     doc.takenAt   ? new Date(doc.takenAt)    : null,
    completedAt: doc.status === "DONE" ? new Date(doc.$updatedAt) : null,
    // customerWaiting = true for critical tasks (ranks 1 & 2)
    customerWaiting: priority <= 2,
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

// Sort ascending by numeric priority rank (1 = most urgent, 7 = least urgent)
const sortTasks = (tasks: PrinterTask[]): PrinterTask[] =>
  [...tasks].sort((a, b) =>
    a.priority !== b.priority
      ? a.priority - b.priority          // lower rank = higher urgency
      : a.createdAt.getTime() - b.createdAt.getTime()
  );

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoggedIn,  setIsLoggedIn]  = useState(false);
  const [tasks,       setTasks]       = useState<PrinterTask[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [printers,    setPrinters]    = useState<PrinterHealth[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [sessionSecret, setSessionSecret] = useState<string | null>(null);
  const subscriptionRef = useRef<(() => void) | null>(null);

  // ── Fetch live data ────────────────────────────────────────────────────────
  const refreshData = async () => {
    try {
      // Use the sessionSecret from state if available
      const currentSession = await AsyncStorage.getItem("sessionSecret") || sessionSecret || undefined;

      // 1. Tasks (Try Backend Function, Fallback to direct DB list)
      try {
        const taskRes = await executeFunction("/tasks", "GET", undefined, currentSession);
        const rawTasks = (taskRes.tasks || []).map(mapTask);
        setTasks(rawTasks);
      } catch (funcErr) {
        console.warn("[AppContext] Backend function failed, falling back to direct DB fetch:", funcErr);
        const taskDocs = await listDocuments("tasks_collection", currentSession);
        setTasks(sortTasks(taskDocs.map(mapTask)));
      }

      // 2. Printers
      const pDocs = await listDocuments("printers", currentSession);
      console.log("[AppContext] printers fetched:", pDocs.length);
      setPrinters(pDocs.map(mapPrinter));

      // 3. Technicians (Users)
      const uDocs = await listDocuments("users_collection", currentSession);
      console.log("[AppContext] technicians fetched:", uDocs.length);
      setTechnicians(uDocs.map(mapTechnician));
    } catch (err) {
      console.error("[AppContext] refreshData error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Realtime Subscriptions ────────────────────────────────────────────────
  const setupSubscriptions = () => {
    if (subscriptionRef.current) {
      subscriptionRef.current();
    }

    const channelPrefix = `databases.${APPWRITE.databaseId}.collections`;
    
    const unsubscribe = client.subscribe(
      [
        `${channelPrefix}.tasks_collection.documents`,
        `${channelPrefix}.printers.documents`,
        `${channelPrefix}.users_collection.documents`
      ],
      (response) => {
        const { events, payload } = response;
        
        // Handle Tasks
        if (events.some(e => e.includes("tasks_collection"))) {
          const task = mapTask(payload);
          setTasks(prev => {
            const index = prev.findIndex(t => t.id === task.id);
            if (index > -1) {
              const updated = [...prev];
              updated[index] = task;
              return updated;
            }
            return sortTasks([task, ...prev]);
          });
        }

        // Handle Printers
        if (events.some(e => e.includes("printers"))) {
          const printer = mapPrinter(payload);
          setPrinters(prev => {
            const index = prev.findIndex(p => p.id === printer.id);
            if (index > -1) {
              const updated = [...prev];
              updated[index] = printer;
              return updated;
            }
            return [printer, ...prev];
          });
        }

        // Handle Technicians (Users)
        if (events.some(e => e.includes("users_collection"))) {
          const tech = mapTechnician(payload);
          setTechnicians(prev => {
            const index = prev.findIndex(t => t.id === tech.id);
            if (index > -1) {
              const updated = [...prev];
              updated[index] = tech;
              return updated;
            }
            return [tech, ...prev];
          });
        }
      }
    );

    subscriptionRef.current = unsubscribe;
  };

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const storedUser = await AsyncStorage.getItem("currentUser");
        const storedSession = await AsyncStorage.getItem("sessionSecret");
        
        if (storedSession) {
          const { getAccount } = await import("@/lib/appwrite");
          const account = await getAccount(storedSession);
          
          if (account) {
            setSessionSecret(storedSession);
            if (storedUser) {
              setCurrentUser(JSON.parse(storedUser));
              setIsLoggedIn(true);
            } else {
              // Re-fetch user details if missing
              setCurrentUser({
                id: account.$id,
                name: account.name,
                email: account.email,
                role: account.email.includes("admin") ? "Senior Technician" : "Technician"
              });
              setIsLoggedIn(true);
            }
          } else {
            // Session expired
            await AsyncStorage.multiRemove(["currentUser", "sessionSecret"]);
          }
        }
      } catch (err) {
        console.error("[AppContext] init error:", err);
      } finally {
        await refreshData();
        setupSubscriptions();
      }
    };
    init();
    return () => { if (subscriptionRef.current) subscriptionRef.current(); };
  }, []);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const { createSession, getAccount } = await import("@/lib/appwrite");
      
      // 1. Create real Appwrite session
      const session = await createSession(email, password);
      const secret = session.secret || session.$id; // Depending on SDK version/platform
      
      // 2. Get account details to verify technician mapping
      const account = await getAccount(secret);
      
      if (account) {
        const user: CurrentUser = { 
          id: account.$id, 
          name: account.name, 
          email: account.email, 
          role: account.email.includes("admin") ? "Senior Technician" : "Technician" 
        };
        
        setSessionSecret(secret);
        setCurrentUser(user);
        setIsLoggedIn(true);
        
        await AsyncStorage.setItem("currentUser", JSON.stringify(user));
        await AsyncStorage.setItem("sessionSecret", secret);
        
        // 3. Register for push notifications & store in Appwrite
        try {
          const { registerForPushNotificationsAsync } = await import("@/services/notifications");
          const pushToken = await registerForPushNotificationsAsync();
          
          if (pushToken) {
            // Requirement 7: Support multiple devices using an array
            // Fetch the specific user document to update tokens
            if (pushToken && account?.$id) {
              await executeFunction("/saveToken", "POST", { 
                userId: account.$id, 
                fcmToken: pushToken 
              }, secret);
              console.log("[AppContext] FCM token registered via Backend.");
            }
          }
        } catch (pushErr) {
          console.error("[AppContext] Notification registration failed (non-critical):", pushErr);
        }

        // Refresh with auth header
        await refreshData();
        return true;
      }
    } catch (err: any) {
      console.error("[AppContext] Login failed:", err.message);
      // alert(err.message); // Could be shown in UI
    }
    return false;
  };

  const logout = async () => {
    try {
      if (sessionSecret) {
        const { deleteSession } = await import("@/lib/appwrite");
        await deleteSession(sessionSecret);
      }
    } catch (err) {
      console.error("[AppContext] Logout backend failed:", err);
    }
    
    setSessionSecret(null);
    setCurrentUser(null);
    setIsLoggedIn(false);
    await AsyncStorage.multiRemove(["currentUser", "sessionSecret"]);
  };

  const bypassLogin = async () => {
    const guestUser: CurrentUser = {
      id: "guest_123",
      name: "Guest Technician",
      email: "guest@college.edu",
      role: "Senior Technician"
    };
    
    const mockSecret = "bypass_token_" + Date.now();
    setSessionSecret(mockSecret);
    setCurrentUser(guestUser);
    setIsLoggedIn(true);
    
    await AsyncStorage.setItem("currentUser", JSON.stringify(guestUser));
    await AsyncStorage.setItem("sessionSecret", mockSecret);
    
    // 3. Register for push notifications & store in Appwrite
    try {
      const { registerForPushNotificationsAsync } = await import("@/services/notifications");
      const pushToken = await registerForPushNotificationsAsync();
      
      if (pushToken) {
        // Since we are bypassing, we use the guest ID directly
        // Ensure your users_collection allows "Any" role to update or has a guest_123 document.
        const uDocs = await listDocuments("users_collection", mockSecret);
        const myDoc = uDocs.find(d => d.$id === guestUser.id);
        
        if (myDoc) {
          const currentTokens = Array.isArray(myDoc.fcmToken) ? myDoc.fcmToken : [];
          if (!currentTokens.includes(pushToken)) {
            const updatedTokens = [...currentTokens, pushToken];
            await updateDocument("users_collection", guestUser.id, { fcmToken: updatedTokens }, mockSecret);
            console.log("[AppContext] FCM token registered for Guest (Success).");
          } else {
            console.log("[AppContext] Guest device already registered.");
          }
        } else {
          // Attempt to create/update even if doc not found
          await updateDocument("users_collection", guestUser.id, { fcmToken: [pushToken] }, mockSecret);
          console.log("[AppContext] FCM token saved to new Guest document.");
        }
      }
    } catch (pushErr) {
      console.error("[AppContext] Guest notification registration failed:", pushErr);
    }

    // Attempt to refresh data, although it may fail if backend rules are strict
    refreshData();
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
      const currentSession = await AsyncStorage.getItem("sessionSecret") || sessionSecret || undefined;
      await updateDocument("tasks_collection", taskId, { employeeId: currentUser.id }, currentSession);
    } catch (e) {
      console.error("[takeTask] failed:", e);
      refreshData();
    }
  };

  const updateTaskStatus = (taskId: string, status: TaskStatus) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
  };

  const completeTask = async (taskId: string, notes?: string) => {
    const task = tasks.find(t => t.id === taskId);
    
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: "Completed", completedAt: new Date(), notes } : t
    ));

    try {
      const currentSession = await AsyncStorage.getItem("sessionSecret") || sessionSecret || undefined;
      
      // 1. Complete via Backend (calculates ART, updates technician stats, history logging)
      await executeFunction(`/complete/${taskId}`, "PUT", { 
        employeeId: currentUser?.id,   // standardized key
        notes: notes ?? "" 
      }, currentSession);

      // Local state is updated via socket listener once backend confirms status: "DONE"
      // or we can keep the local optimistic update for snappiness.

      // 2. Synchronize Printer Health (locally for immediate feedback)
      if (task?.printerId) {
        const printer = printers.find(p => p.printerId === task.printerId);
        if (printer) {
          const isPaperIssue = ["No Paper", "Paper Empty", "Low Paper"].includes(task.issueType);
          const printerUpdate: Partial<PrinterHealth> = {
            lastServiced: new Date(),
            ...(isPaperIssue ? { paperLevel: 100, status: "Online" } : {})
          };

          setPrinters(prev => prev.map(p => 
            p.printerId === task.printerId ? { ...p, ...printerUpdate } : p
          ));

          // Also update printer on backend (could be moved to function later)
          await updateDocument("printers", printer.id, printerUpdate, currentSession);
        }
      }
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
      const currentSession = sessionSecret || undefined;
      
      // Create task via Backend. Send priority: 7 (default/initializing).
      // Backend will calculate the true numeric rank (1-6) based on issue type.
      executeFunction("/tasks", "POST", {
        printerId: newPrinter.printerId,
        location: newPrinter.location,
        issueType: [isZero ? "No Paper" : "Low Paper"],
        building: newPrinter.building,
        floor: newPrinter.floor,
        priority: 7
      }, currentSession as string).then(() => refreshData());
    }
  };

  const updatePrinter = async (id: string, data: Partial<PrinterHealth>) => {
    setPrinters(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
    try {
      const currentSession = await AsyncStorage.getItem("sessionSecret") || sessionSecret || undefined;
      await updateDocument("printers", id, data, currentSession);
    } catch (e) {
      console.error("[updatePrinter] failed:", e);
    }
  };

  return (
    <AppContext.Provider value={{
      currentUser, isLoggedIn, tasks, technicians, printers, isLoading,
      login, logout, takeTask, updateTaskStatus, completeTask,
      requestAssistance, addPrinter, updatePrinter, refreshData, bypassLogin,
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
