import { Client, Databases, Users, Messaging, ID, Query } from 'node-appwrite';

/**
 * node-appwrite Function: SupportA4 Backend (Robust Version)
 */
export default async ({ req, res, log, error }) => {
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_ENDPOINT || process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);


    const databases = new Databases(client);
    const messaging = new Messaging(client);
    const users = new Users(client);

    const DATABASE_ID = '69cbdded00392d03962c';
    const TASKS_COL = 'maintenance'; 
    const USERS_COL = 'users';      
    const PRINTERS_COL = 'printers';
    const FCM_PROVIDER_ID = '69d4d2ce0027660c1fe2';

    const path = req.path || '/';
    const method = req.method;

    // Safety: Parse body only if it exists
    let payload = {};
    if (req.body) {
        try {
            payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } catch (e) {
            log('Payload parse failed, using empty object');
        }
    }

    log(`API CALL: ${method} ${path}`);

    try {
        // --- 1. HEALTH CHECK ---
        if (path === '/ping') {
            return res.json({ success: true, message: 'SupportA4 Backend Online', timestamp: new Date().toISOString() });
        }

        // --- 2. LOGIN / USER SEARCH ---
        if (path === '/users' && method === 'GET') {
            const result = await databases.listDocuments(DATABASE_ID, USERS_COL);
            return res.json({ success: true, users: result.documents });
        }

        // --- 3. GET PRINTERS ---
        if (path === '/printers' && method === 'GET') {
            const result = await databases.listDocuments(DATABASE_ID, PRINTERS_COL, [
                Query.limit(100)
            ]);
            return res.json({ success: true, printers: result.documents });
        }

        // --- 4. TASKS LIST ---
        if (path === '/tasks' && method === 'GET') {

            const result = await databases.listDocuments(DATABASE_ID, TASKS_COL, [
                Query.limit(100),
                Query.orderDesc('$createdAt')
            ]);
            return res.json({ success: true, tasks: result.documents });
        }

        // --- 4. CREATE TASK ---
        if (path === '/tasks' && method === 'POST') {
            const doc = await databases.createDocument(DATABASE_ID, TASKS_COL, ID.unique(), {
                printer_id: payload.printerId || 'Unknown',
                location: payload.location || 'Unknown',
                error_type: payload.issueType ? (Array.isArray(payload.issueType) ? payload.issueType[0] : payload.issueType) : 'Error',
                building: payload.building || '-',
                floor: payload.floor || '-',
                printerFixed: false,
                startTime: new Date().toISOString()
            });

            // Auto-notify if high priority (Simple placeholder for now)
            return res.json({ success: true, data: doc });
        }

        // --- 5. SAVE FCM TOKEN ---
        if (path === '/saveToken' && method === 'POST') {
            const { userId, fcmToken } = payload;
            if (userId && fcmToken) {
                try {
                    await users.createTarget(userId, ID.unique(), 'push', fcmToken, undefined, FCM_PROVIDER_ID);
                    await databases.updateDocument(DATABASE_ID, USERS_COL, userId, { fcmToken });
                } catch (e) {
                    log('Token update warning: ' + e.message);
                }
            }
            return res.json({ success: true });
        }

        // --- 6. COMPLETE TASK ---
        if (path.startsWith('/complete/') && method === 'PUT') {
            const taskId = path.replace('/complete/', '');
            await databases.updateDocument(DATABASE_ID, TASKS_COL, taskId, {
                printerFixed: true,
                endTime: new Date().toISOString(),
                notes: payload.notes || ""
            });
            return res.json({ success: true, message: 'Task marked as fixed' });
        }

        return res.json({ success: false, error: 'Route not found: ' + path }, 404);

    } catch (e) {
        error('RUNTIME ERROR: ' + e.message);
        return res.json({ success: false, error: e.message }, 500);
    }
};
