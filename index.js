import { Client, Databases, Messaging, ID, Query } from 'node-appwrite';

/*
 * ---------------------------------------------------------
 * CONSTANTS
 * ---------------------------------------------------------
 */
const DatabaseId = "69cbdded00392d03962c";
const TasksCollection = "tasks_collection";
const PrintersCollection = "printers";
const UsersCollection = "users_collection";
const HistoryCollection = "history_collection";

/*
 * ---------------------------------------------------------
 * LOGIC HELPERS
 * ---------------------------------------------------------
 */
function determinePriority(issues) {
    if (!issues || issues.length === 0) return "LOW";
    
    // High priority signals
    const highSignals = ["Paper Jam", "No Paper"];
    if (issues.some(issue => highSignals.includes(issue))) {
        return "HIGH";
    }

    // Medium priority signals
    const mediumSignals = ["Ink Low", "Low Paper"];
    if (issues.some(issue => mediumSignals.includes(issue))) {
        return "MEDIUM";
    }

    return "LOW";
}

function determineDeadline(priority, fromDate = new Date()) {
    const deadline = new Date(fromDate);
    switch (priority) {
        case "HIGH":
            deadline.setMinutes(deadline.getMinutes() + 5);
            break;
        case "MEDIUM":
            deadline.setMinutes(deadline.getMinutes() + 15);
            break;
        case "LOW":
        default:
            deadline.setMinutes(deadline.getMinutes() + 30);
            break;
    }
    return deadline.toISOString();
}

function sortTasks(tasks) {
    const priorityWeight = { "HIGH": 3, "MEDIUM": 2, "LOW": 1 };

    return tasks.sort((a, b) => {
        // Priority weight first
        const pi = priorityWeight[a.priority] || 0;
        const pj = priorityWeight[b.priority] || 0;
        if (pi !== pj) return pj - pi;

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

    const now = new Date();
    const priority = determinePriority(issues);
    const deadline = determineDeadline(priority, now);

    const taskData = {
        printerId,
        issues,
        priority,
        createdAt: now.toISOString(),
        deadline,
        status: "ACTIVE",
        shared: false
    };

    const doc = await db.createDocument(DatabaseId, TasksCollection, ID.unique(), taskData);

    // Fire alarm if HIGH priority
    if (priority === "HIGH") {
        log("🔥 High priority task detected! Sending notifications...");
        try {
            // Find technicians/admins
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
                    [], // topics
                    technicianIds // users
                );
            }
        } catch (err) {
            log(`Notification Error: ${err.message}`);
        }
    }

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

// Complete a task and update technician stats
async function completeTask(db, taskId, payload) {
    const { employeeId } = payload;
    
    const task = await db.getDocument(DatabaseId, TasksCollection, taskId);
    const createdAt = new Date(task.createdAt || task.$createdAt);
    const resolvedAt = new Date();
    const timeTaken = Math.floor((resolvedAt - createdAt) / (1000 * 60)); // Minutes

    // 1. Log to history
    await db.createDocument(DatabaseId, HistoryCollection, ID.unique(), {
        taskId: task.$id,
        employeeId,
        printerId: task.printerId,
        issues: task.issues,
        resolvedAt: resolvedAt.toISOString(),
        timeTaken
    });

    // 2. Mark task as DONE
    await db.updateDocument(DatabaseId, TasksCollection, taskId, { status: "DONE" });

    // 3. Update technician stats
    if (employeeId) {
        try {
            const user = await db.getDocument(DatabaseId, UsersCollection, employeeId);
            const newTotal = (user.totalTasks || 0) + 1;
            const newAvg = Math.floor((((user.avgResponseTime || 0) * (user.totalTasks || 0)) + timeTaken) / newTotal);

            await db.updateDocument(DatabaseId, UsersCollection, employeeId, {
                totalTasks: newTotal,
                avgResponseTime: newAvg
            });
        } catch (err) {
            // Log error but don't fail task completion
            console.error(`Stats Update Error: ${err.message}`);
        }
    }

    return { success: true, message: "Task completed" };
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

// Get aggregate stats for a user
async function getUserStats(db, payload) {
    const { employeeId } = payload;
    if (!employeeId) throw new Error("employeeId is required.");

    const user = await db.getDocument(DatabaseId, UsersCollection, employeeId);
    return {
        success: true,
        data: {
            totalTasks: user.totalTasks,
            avgResponseTime: user.avgResponseTime,
            successRate: user.successRate
        }
    };
}

/*
 * ---------------------------------------------------------
 * MAIN APPWRITE HANDLER
 * ---------------------------------------------------------
 */
export default async ({ req, res, log, error }) => {
    // 1. CORS Preflight
    if (req.method === 'OPTIONS') {
        return res.json({}, 200);
    }

    // 2. Initialize Appwrite Clients
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://cloud.appwrite.io/v1')
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);

    const db = new Databases(client);
    const msg = new Messaging(client);

    const path = req.path;
    const method = req.method;
    const payload = req.bodyJson; // Appwrite runtime parses JSON for us

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
        error(`❌ Error Processing Request: ${err.message}`);
        return res.json({ success: false, error: err.message }, 500);
    }
};
