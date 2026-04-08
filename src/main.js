import { Client, Databases, Messaging, ID, Query } from 'node-appwrite';

/*
 * ---------------------------------------------------------
 * CONSTANTS
 * ---------------------------------------------------------
 */
const DatabaseId = "69cbdded00392d03962c";
const TasksCollection = "tasks_collection";
const PrintersCollection = "printers";
const UsersCollection = "users";
const HistoryCollection = "history_collection";
const ShopsCollection = "shops";
const MaintenanceCollection = "maintenance";

/*
 * ---------------------------------------------------------
 * LOGIC HELPERS
 * ---------------------------------------------------------
 */
function determinePriority(issues) {
    if (!issues || issues.length === 0) return 7; // Default to lowest
    
    const issuesJoined = issues.join(" ").toLowerCase();

    if (issuesJoined.includes("no paper")) return 1;
    if (issuesJoined.includes("service requested")) return 2;
    if (issuesJoined.includes("printer jammed") || issuesJoined.includes("paper jam")) return 3;
    if (issuesJoined.includes("door opened")) return 4;
    if (issuesJoined.includes("no ink") || issuesJoined.includes("ink low")) return 5;
    if (issuesJoined.includes("printer offline")) return 6;

    return 7;
}

function determineDeadline(priority, fromDate = new Date()) {
    const deadline = new Date(fromDate);
    // Deadlines in minutes based on priority rank (1-7)
    const weights = {
        1: 5,   // No Paper: 5 mins
        2: 10,  // Service: 10 mins
        3: 15,  // Jammed: 15 mins
        4: 20,  // Door: 20 mins
        5: 30,  // No Ink: 30 mins
        6: 45,  // Offline: 45 mins
        7: 60   // Other: 1 hour
    };

    const minutes = weights[priority] || 60;
    deadline.setMinutes(deadline.getMinutes() + minutes);
    return deadline.toISOString();
}

function sortTasks(tasks) {
    return tasks.sort((a, b) => {
        // Priority rank first (lower number = higher priority)
        const pi = Number(a.priority) || 7;
        const pj = Number(b.priority) || 7;
        if (pi !== pj) return pi - pj;

        // Deadline second
        const di = new Date(a.deadline).getTime();
        const dj = new Date(b.deadline).getTime();
        if (di !== dj) return di - dj;

        // Created At third
        const ci = new Date(a.$createdAt || a.createdAt).getTime();
        const cj = new Date(b.$createdAt || b.createdAt).getTime();
        return ci - cj;
    });
}

/*
 * ---------------------------------------------------------
 * ROUTE HANDLERS
 * ---------------------------------------------------------
 */

// Fetch all active/ongoing tasks
async function getTasks(db) {
    const response = await db.listDocuments(DatabaseId, TasksCollection, [
        Query.or([
            Query.equal('status', 'ACTIVE'),
            Query.equal('status', 'ongoing')
        ])
    ]);
    
    const sortedTasks = sortTasks(response.documents);
    return { success: true, data: sortedTasks };
}

// Create a new maintenance task
async function createTask(db, msg, log, payload) {
    const { printerId, issues } = payload;
    if (!printerId || !issues) {
        throw new Error("printerId and issues are required.");
    }

    const taskData = {
        printerId,
        issues,
        createdAt: new Date().toISOString(),
        status: "ACTIVE",
        priority: "PENDING", // Will be updated by event handler
        shared: false
    };

    const doc = await db.createDocument(DatabaseId, TasksCollection, ID.unique(), taskData);
    return { success: true, data: doc };
}

// Save device token for push notifications
async function saveToken(db, log, payload) {
    const { userId, fcmToken } = payload;
    if (!userId || !fcmToken) {
        throw new Error("userId and fcmToken are required.");
    }

    // 1. Update user collection
    try {
        await db.updateDocument(DatabaseId, UsersCollection, userId, { fcmToken });
    } catch (err) {
        log(`Warning: Failed to update User collection: ${err.message}`);
    }

    // Note: Targets are usually managed via Appwrite's User API (Account API),
    // but in a server context, we primarily rely on the user collection for lookup.
    // In Appwrite 1.5+, Push notifications can use user IDs directly.
    return { success: true };
}

// Complete a task (HTTP shortcut)
async function completeTask(db, taskId, payload) {
    const { employeeId } = payload;
    
    // Simply mark as DONE. The Event Handler will pick this up and
    // handle stats/history logging automatically.
    await db.updateDocument(DatabaseId, TasksCollection, taskId, { 
        status: "DONE",
        employeeId: employeeId
    });

    return { success: true, message: "Task completion triggered" };
}

// Logic to process completion (called by Event Handler)
async function processTaskCompletion(db, taskId, employeeId, log) {
    try {
        const task = await db.getDocument(DatabaseId, TasksCollection, taskId);
        
        // Skip if already processed into history
        const existingHistory = await db.listDocuments(DatabaseId, HistoryCollection, [
            Query.equal('taskId', taskId)
        ]);
        if (existingHistory.total > 0) return;

        const createdAt = new Date(task.createdAt || task.$createdAt);
        const resolvedAt = new Date();
        const timeTaken = Math.floor((resolvedAt - createdAt) / (1000 * 60));

        // 1. Log to history
        await db.createDocument(DatabaseId, HistoryCollection, ID.unique(), {
            taskId: task.$id,
            employeeId,
            printerId: task.printerId,
            issues: task.issues,
            resolvedAt: resolvedAt.toISOString(),
            timeTaken
        });

        // 2. Update stats
        if (employeeId) {
            const user = await db.getDocument(DatabaseId, UsersCollection, employeeId);
            const newTotal = (user.totalTasks || 0) + 1;
            const newAvg = Math.floor((((user.avgResponseTime || 0) * (user.totalTasks || 0)) + timeTaken) / newTotal);

            await db.updateDocument(DatabaseId, UsersCollection, employeeId, {
                totalTasks: newTotal,
                avgResponseTime: newAvg
            });
        }
    } catch (err) {
        log(`Stats Error: ${err.message}`);
    }
}

// Update printer status (Health check)
async function updatePrinter(db, payload) {
    const { printerId, currentPaper, queueCount, status } = payload;
    if (!printerId) throw new Error("printerId is required.");

    const updateData = {
        currentPaper,
        queueCount,
        status,
        lastUpdated: new Date().toISOString()
    };

    await db.updateDocument(DatabaseId, PrintersCollection, printerId, updateData);
    return { success: true, message: "Printer updated successfully" };
}

// Get all shops
async function getShops(db) {
    const response = await db.listDocuments(DatabaseId, ShopsCollection);
    return { success: true, data: response.documents };
}

// Get all maintenance records
async function getMaintenance(db) {
    const response = await db.listDocuments(DatabaseId, MaintenanceCollection);
    return { success: true, data: response.documents };
}

// Create a maintenance record
async function createMaintenance(db, payload) {
    const { printer_id, startTime, error_type, printerFixed, employeeId, email } = payload;
    if (!printer_id || !error_type) {
        throw new Error("printer_id and error_type are required.");
    }

    const data = {
        printer_id,
        startTime: startTime || new Date().toISOString(),
        error_type,
        printerFixed: printerFixed || false,
        employeeId,
        email
    };

    const doc = await db.createDocument(DatabaseId, MaintenanceCollection, ID.unique(), data);
    return { success: true, data: doc };
}

// Get all users
async function getUsers(db) {
    const response = await db.listDocuments(DatabaseId, UsersCollection);
    return { success: true, data: response.documents };
}

// Get aggregate stats for a user
async function getUserStats(db, payload) {
    const { employeeId } = payload;
    if (!employeeId) throw new Error("employeeId is required.");

    const user = await db.getDocument(DatabaseId, UsersCollection, employeeId);
    return {
        success: true,
        data: {
            totalTasks: user.totalTasks || 0,
            avgResponseTime: user.avgResponseTime || 0,
            successRate: user.successRate || 0,
            email: user.email,
            phone: user.phone
        }
    };
}

/*
 * ---------------------------------------------------------
 * EVENT HANDLER (REAL-TIME LOGIC)
 * ---------------------------------------------------------
 */

async function handleEvent(db, msg, log, event, payload) {
    log(`🔔 Event Triggered: ${event}`);

    // Handle Task creation (Auto-calculate priority/deadline)
    if (event.includes('collections.tasks_collection.documents.*.create')) {
        const doc = payload;
        if (!doc.priority || doc.priority === "PENDING") {
            const priority = determinePriority(doc.issues);
            const deadline = determineDeadline(priority, new Date(doc.$createdAt));
            
            log(`✨ Task Created: Calculating priority (${priority}) and deadline...`);
            await db.updateDocument(DatabaseId, TasksCollection, doc.$id, {
                priority,
                deadline
            });

            // Send Push for Critical priority (Rank 1-3)
            if (priority <= 3) {
                await sendHighPriorityAlert(db, msg, log, doc.issues);
            }
        }
    }

    // Handle Task completion (Stats & History)
    if (event.includes('collections.tasks_collection.documents.*.update')) {
        const doc = payload;
        // Check if just marked as DONE
        if (doc.status === "DONE") {
            log(`✅ Task ${doc.$id} marked DONE. Processing stats...`);
            await processTaskCompletion(db, doc.$id, doc.employeeId, log);
        }
    }
}

async function sendHighPriorityAlert(db, msg, log, issues) {
    try {
        const usersResp = await db.listDocuments(DatabaseId, UsersCollection, [
            Query.or([
                Query.equal('role', 'technician'),
                Query.equal('role', 'admin')
            ])
        ]);

        const technicianIds = usersResp.documents.map(u => u.$id);
        if (technicianIds.length > 0) {
            await msg.createPush(
                ID.unique(),
                "🚨 High Priority Alarm",
                `Urgent printer issue: ${issues.join(", ")}`,
                [],
                technicianIds
            );
        }
    } catch (err) {
        log(`Notification Error: ${err.message}`);
    }
}

/*
 * ---------------------------------------------------------
 * MAIN APPWRITE HANDLER
 * ---------------------------------------------------------
 */
export default async ({ req, res, log, error }) => {
    // 1. Initialize Clients
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://cloud.appwrite.io/v1')
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);

    const db = new Databases(client);
    const msg = new Messaging(client);

    // 2. Detect Mode (Event vs HTTP)
    const event = req.headers['x-appwrite-event'];
    
    if (event) {
        try {
            await handleEvent(db, msg, log, event, req.bodyJson);
            return res.json({ success: true, message: "Event processed" });
        } catch (err) {
            error(`❌ Event Error: ${err.message}`);
            return res.json({ success: false, error: err.message }, 500);
        }
    }

    // 3. HTTP Path Routing
    const path = req.path;
    const method = req.method;

    if (method === 'OPTIONS') return res.json({}, 200);

    let payload = {};
    if (method === 'POST' || method === 'PUT') {
        try {
            payload = req.bodyJson || {};
        } catch (e) {
            payload = {};
        }
    }

    log(`🚀 Incoming: ${method} ${path}`);

    try {
        let responseData;

        if (path === '/tasks') {
            if (method === 'GET') responseData = await getTasks(db);
            if (method === 'POST') responseData = await createTask(db, msg, log, payload);
        } else if (path === '/saveToken' && method === 'POST') {
            responseData = await saveToken(db, log, payload);
        } else if (path === '/printers') {
            if (method === 'GET') {
                const docs = await db.listDocuments(DatabaseId, PrintersCollection);
                responseData = { success: true, data: docs.documents };
            }
            if (method === 'PUT') responseData = await updatePrinter(db, payload);
        } else if (path === '/shops' && method === 'GET') {
            responseData = await getShops(db);
        } else if (path === '/maintenance') {
            if (method === 'GET') responseData = await getMaintenance(db);
            if (method === 'POST') responseData = await createMaintenance(db, payload);
        } else if (path === '/users' && method === 'GET') {
            responseData = await getUsers(db);
        } else if (path === '/users/stats' && method === 'POST') {
            responseData = await getUserStats(db, payload);
        } else if (path.startsWith('/complete/') && method === 'PUT') {
            const taskId = path.split('/').pop();
            responseData = await completeTask(db, taskId, payload);
        }

        if (!responseData) {
            return res.json({ success: false, error: `Route not found: ${path}` }, 404);
        }

        return res.json(responseData);

    } catch (err) {
        error(`❌ API Error: ${err.message}`);
        return res.json({ success: false, error: err.message }, 500);
    }
};
