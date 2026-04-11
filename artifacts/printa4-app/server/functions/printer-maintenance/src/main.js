const sdk = require('node-appwrite');

/**
 * Technical Specification: Printer Maintenance Backend (Node.js)
 * Logic for health monitoring, task prioritization, and technician notifications.
 */

module.exports = async function (req, res) {
    const client = new sdk.Client()
        .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID);

    // Prefer API KEY for Admin actions (Messaging/Global Updates)
    // Fallback to JWT if provided in the calling request
    const apiKey = process.env.APPWRITE_API_KEY;
    const jwt = req.headers['x-appwrite-user-jwt'];

    if (apiKey) {
        client.setKey(apiKey);
    } else if (jwt) {
        client.setJWT(jwt);
    }

    const { 
      path = '/', 
      method = 'GET', 
      body: reqBody = {} 
    } = req;
    
    // Parse body if it's a string
    let body = reqBody;
    try {
        if (typeof reqBody === 'string' && reqBody.startsWith('{')) {
            body = JSON.parse(reqBody);
        }
    } catch (e) {
        return res.json({ error: 'Invalid JSON body' }, 400);
    }

    const databases = new sdk.Databases(client);
    const messaging = new sdk.Messaging(client);
    const users = new sdk.Users(client);

    const DATABASE_ID = '69cbdded00392d03962c';
    const TASKS_COLLECTION = 'tasks_collection';
    const PRINTERS_COLLECTION = 'printers';
    const USERS_COLLECTION = 'users_collection';

    try {
        // --- ROUTE: GET /tasks ---
        if (path === '/tasks' && method === 'GET') {
            const list = await databases.listDocuments(DATABASE_ID, TASKS_COLLECTION);
            
            // Urgency Weight: HIGH(3), MEDIUM(2), LOW(1)
            const getPriorityWeight = (p) => {
                const up = (p || '').toUpperCase();
                if (up === 'HIGH') return 3;
                if (up === 'MEDIUM') return 2;
                return 1;
            };

            const sorted = list.documents.sort((a, b) => {
                const wA = getPriorityWeight(a.priority);
                const wB = getPriorityWeight(b.priority);
                
                // 1. Urgency
                if (wB !== wA) return wB - wA;
                
                // 2. Deadline (earlier is more urgent)
                const dA = new Date(a.deadline || a.$createdAt).getTime();
                const dB = new Date(b.deadline || b.$createdAt).getTime();
                if (dA !== dB) return dA - dB;
                
                // 3. Time Created
                return new Date(a.$createdAt).getTime() - new Date(b.$createdAt).getTime();
            });

            return res.json({ success: true, tasks: sorted });
        }

        // --- ROUTE: POST /tasks ---
        if (path === '/tasks' && method === 'POST') {
            const { printerId, issues = [], location, building, floor } = body;
            
            // Logic: Auto-flag High Priority
            const isHigh = issues.some(i => i === 'Paper Jam' || i === 'No Paper');
            const priority = isHigh ? 'HIGH' : (body.priority || 'MEDIUM');

            // Set Deadlines (relative to now)
            const now = new Date();
            let duration = 30; // Default Low
            if (priority === 'HIGH') duration = 5;
            else if (priority === 'MEDIUM') duration = 15;
            
            const deadline = new Date(now.getTime() + duration * 60000).toISOString();

            const newTask = await databases.createDocument(DATABASE_ID, TASKS_COLLECTION, sdk.ID.unique(), {
                printerId,
                issues,
                location,
                building,
                floor,
                priority,
                deadline,
                status: 'UNASSIGNED',
                createdAt: now.toISOString()
            });

            // Alerts: Push for HIGH priority
            if (priority === 'HIGH' && apiKey) {
                try {
                    // Fetch users from our collection who have FCM tokens
                    const techDocs = await databases.listDocuments(DATABASE_ID, USERS_COLLECTION);
                    const tokens = techDocs.documents
                        .flatMap(d => d.fcmToken || [])
                        .filter(t => !!t);

                    if (tokens.length > 0) {
                        await messaging.createPush(
                          sdk.ID.unique(),
                          `Urgent Task: ${issues[0] || 'Printer Issue'}`,
                          `New High Priority task at ${location || 'Main Office'}`,
                          undefined, // topics
                          undefined, // users
                          tokens // targets (for specific FCM tokens)
                        );
                    }
                } catch (pushErr) {
                    console.error('[Notification Failed]', pushErr);
                }
            }

            return res.json({ success: true, taskId: newTask.$id, priority, deadline });
        }

        // --- ROUTE: PUT /complete/{taskId} ---
        if (path.startsWith('/complete/') && (method === 'PUT' || method === 'POST')) {
            const taskId = path.split('/').pop();
            const { technicianId, notes } = body;

            // 1. Get the current task to find takenAt
            const task = await databases.getDocument(DATABASE_ID, TASKS_COLLECTION, taskId);
            const now = new Date();
            const takenAt = task.takenAt ? new Date(task.takenAt) : new Date(task.$createdAt);
            const timeTaken = (now.getTime() - takenAt.getTime()) / 60000; // minutes

            // 2. Mark as DONE
            await databases.updateDocument(DATABASE_ID, TASKS_COLLECTION, taskId, {
                status: 'DONE',
                completedAt: now.toISOString(),
                notes: notes || ''
            });

            // 3. Update Technician Stats
            if (technicianId) {
                const techDoc = await databases.getDocument(DATABASE_ID, USERS_COLLECTION, technicianId);
                const prevCount = techDoc.tasksCompleted || 0;
                const prevART = techDoc.avgResponseTime || 0;

                const newCount = prevCount + 1;
                const newART = ((prevART * prevCount) + timeTaken) / newCount;

                await databases.updateDocument(DATABASE_ID, USERS_COLLECTION, technicianId, {
                    tasksCompleted: newCount,
                    avgResponseTime: parseFloat(newART.toFixed(2))
                });
            }

            return res.json({ success: true, timeTaken });
        }

        // --- ROUTE: POST /saveToken ---
        if (path === '/saveToken' && method === 'POST') {
            const { userId, fcmToken } = body;
            if (!userId || !fcmToken) return res.json({ error: 'Missing userId or fcmToken' }, 400);

            const userDoc = await databases.getDocument(DATABASE_ID, USERS_COLLECTION, userId);
            const currentTokens = Array.isArray(userDoc.fcmToken) ? userDoc.fcmToken : [];
            
            if (!currentTokens.includes(fcmToken)) {
                await databases.updateDocument(DATABASE_ID, USERS_COLLECTION, userId, {
                    fcmToken: [...currentTokens, fcmToken]
                });
            }

            return res.json({ success: true });
        }

        // --- ROUTE: PUT /printers ---
        if (path === '/printers' && (method === 'PUT' || method === 'POST')) {
            const { printerId, paperLevel, queueCount, status } = body;
            
            // Find printer by printerId attribute if ID is not direct
            const printerList = await databases.listDocuments(DATABASE_ID, PRINTERS_COLLECTION, [
                sdk.Query.equal('printerId', printerId)
            ]);

            if (printerList.total > 0) {
                const docId = printerList.documents[0].$id;
                await databases.updateDocument(DATABASE_ID, PRINTERS_COLLECTION, docId, {
                    currentPaper: paperLevel,
                    status: status || (paperLevel === 0 ? 'Warning' : 'Online'),
                    lastUpdated: new Date().toISOString()
                });
                return res.json({ success: true });
            }

            return res.json({ success: false, message: 'Printer not found' });
        }

        // Default: 404
        return res.json({ error: `Not Found: ${method} ${path}` }, 404);

    } catch (err) {
        console.error(err);
        return res.json({ 
          success: false, 
          message: err.message, 
          code: err.code 
        }, err.code || 500);
    }
};
