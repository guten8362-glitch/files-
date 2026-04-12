import { Client, Databases, Users, Messaging, ID, Query } from 'node-appwrite';

/**
 * node-appwrite Function: SupportA4 Backend (Mirror of working Go Logic)
 */
export default async ({ req, res, log, error }) => {
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://cloud.appwrite.io/v1')
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);
    const messaging = new Messaging(client);
    const users = new Users(client);

    const DATABASE_ID = '69cbdded00392d03962c';
    const TASKS_COL = 'tasks_collection';
    const PRINTERS_COL = 'printers';
    const USERS_COL = 'users_collection';
    const HISTORY_COL = 'history_collection';
    const FCM_PROVIDER_ID = '69d4d2ce0027660c1fe2';

    // Helper: Determine Priority matching Go Logic
    const determinePriority = (issues) => {
        const issuesArr = Array.isArray(issues) ? issues : String(issues || '').split(', ');
        for (const issue of issuesArr) {
            if (issue === 'Paper Jam' || issue === 'No Paper') return 'HIGH';
        }
        for (const issue of issuesArr) {
            if (issue === 'Ink Low' || issue === 'Low Paper') return 'MEDIUM';
        }
        return 'LOW';
    };

    // Helper: Determine Deadline matching Go Logic
    const determineDeadline = (priority, fromDate) => {
        let mins = 30;
        if (priority === 'HIGH') mins = 5;
        else if (priority === 'MEDIUM') mins = 15;
        const d = new Date(fromDate);
        d.setMinutes(d.getMinutes() + mins);
        return d.toISOString();
    };

    // Webhook Interception (matching Go logic for broadcasts)
    const eventHeader = req.headers['x-appwrite-event'] || '';
    if (eventHeader.includes('documents') || eventHeader.includes('rows')) {
        const eventBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        if (eventBody.priority === 'HIGH') {
            const title = '🚨 High Priority Alarm';
            const body = `Printer: ${eventBody.printerId} | Issue: ${eventBody.issues}`;
            
            try {
                const userDocs = await databases.listDocuments(DATABASE_ID, USERS_COL);
                const userIds = userDocs.documents.map(u => u.$id);
                if (userIds.length > 0) {
                    await messaging.createPush(ID.unique(), title, body, userIds);
                }
            } catch (e) {
                error('Webhook Push Error: ' + e.message);
            }
        }
        return res.json({ success: true });
    }

    const path = req.path || '/';
    const method = req.method;

    log(`REQUEST [${method}] ${path}`);

    try {
        // --- 1. GET ALL TASKS ---
        if (path === '/tasks' && method === 'GET') {
            const result = await databases.listDocuments(DATABASE_ID, TASKS_COL, [
                Query.or([
                    Query.equal('status', 'ACTIVE'),
                    Query.equal('status', 'ongoing')
                ]),
                Query.limit(100)
            ]);
            return res.json({ success: true, tasks: result.documents });
        }

        // --- 2. CREATE TASK ---
        if (path === '/tasks' && method === 'POST') {
            const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            const now = new Date();
            const priority = determinePriority(payload.issues);
            const deadline = determineDeadline(priority, now);
            const combinedIssues = Array.isArray(payload.issues) ? payload.issues.join(', ') : payload.issues;

            const taskData = {
                printerId: payload.printerId,
                issues: combinedIssues,
                priority: priority,
                createdAt: now.toISOString(),
                deadline: deadline,
                status: 'ACTIVE',
                shared: false
            };

            const doc = await databases.createDocument(DATABASE_ID, TASKS_COL, ID.unique(), taskData);
            
            // Background Notify logic from Go
            if (priority === 'HIGH') {
                try {
                    const userDocs = await databases.listDocuments(DATABASE_ID, USERS_COL);
                    const userIds = userDocs.documents.map(u => u.$id);
                    if (userIds.length > 0) {
                        await messaging.createPush(ID.unique(), '🚨 High Priority Alarm', `Urgent printer issue: ${combinedIssues}`, userIds);
                    }
                } catch (e) {
                    log('Notification error: ' + e.message);
                }
            }
            return res.json({ success: true, data: doc });
        }

        // --- 3. SAVE FCM TOKEN (Correct Target Logic) ---
        if (path === '/saveToken' && method === 'POST') {
            const { userId, fcmToken } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            
            // Create Target in Appwrite 1.5+ (Go Logic)
            try {
                await users.createTarget(userId, ID.unique(), 'push', fcmToken, undefined, FCM_PROVIDER_ID);
            } catch (e) {
                log('Target Registration Warning: ' + e.message);
            }

            // Upsert into users_collection
            try {
                await databases.updateDocument(DATABASE_ID, USERS_COL, userId, { fcmToken });
            } catch (e) {
                await databases.createDocument(DATABASE_ID, USERS_COL, userId, { fcmToken, role: 'technician' });
            }
            return res.json({ success: true });
        }

        // --- 4. GET PRINTERS ---
        if (path === '/printers' && method === 'GET') {
            const result = await databases.listDocuments(DATABASE_ID, PRINTERS_COL);
            return res.json({ success: true, printers: result.documents });
        }

        // --- 5. COMPLETE TASK ---
        if (path.startsWith('/complete/') && method === 'PUT') {
            const taskId = path.replace('/complete/', '');
            const { employeeId, notes } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            
            const task = await databases.getDocument(DATABASE_ID, TASKS_COL, taskId);
            const resolvedAt = new Date();
            const timeTaken = Math.round((resolvedAt - new Date(task.createdAt)) / 60000);

            // 1. History record
            await databases.createDocument(DATABASE_ID, HISTORY_COL, ID.unique(), {
                taskId: task.$id,
                employeeId: employeeId,
                printerId: task.printerId,
                resolvedAt: resolvedAt.toISOString(),
                timeTaken: timeTaken
            });

            // 2. Mark task done
            await databases.updateDocument(DATABASE_ID, TASKS_COL, taskId, { status: 'DONE' });

            // 3. Update User Stats
            if (employeeId) {
                try {
                    const user = await databases.getDocument(DATABASE_ID, USERS_COL, employeeId);
                    const newTotal = (user.totalTasks || 0) + 1;
                    const newAvg = Math.round(((user.avgResponseTime || 0) * (user.totalTasks || 0) + timeTaken) / newTotal);
                    await databases.updateDocument(DATABASE_ID, USERS_COL, employeeId, {
                        totalTasks: newTotal,
                        avgResponseTime: newAvg
                    });
                } catch (e) {
                    log('Stats update error: ' + e.message);
                }
            }
            return res.json({ success: true, message: 'Task completed' });
        }

        // --- 6. USER STATS ---
        if (path === '/users/stats' && method === 'POST') {
            const { employeeId } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            const user = await databases.getDocument(DATABASE_ID, USERS_COL, employeeId);
            return res.json({ success: true, data: {
                totalTasks: user.totalTasks || 0,
                avgResponseTime: user.avgResponseTime || 0,
                successRate: user.successRate || 0
            }});
        }

        // --- 7. TEAM / USERS LIST ---
        if (path === '/users' && method === 'GET') {
            const result = await databases.listDocuments(DATABASE_ID, USERS_COL);
            return res.json({ success: true, users: result.documents });
        }

        return res.json({ success: false, error: 'Route not found' }, 404);

    } catch (e) {
        error('Runtime Error: ' + e.message);
        return res.json({ success: false, error: e.message }, 500);
    }
};
