import { Client, Databases, Users, Messaging, ID, Query } from 'node-appwrite';

/**
 * SupportA4 Backend — One Single Notification Path:
 * uses Appwrite's built-in Messaging service.
 */

// ─── Priority map ─────────────────────────────────────────────────────────────
const PRIORITY_MAP = {
    'No paper': 1, 'No Paper': 1,
    'Service Requested': 2,
    'Jammed': 3, 'Paper Jam': 3,
    'Door Opened': 4,
    'No toner ink': 5, 'No Toner': 5,
    'Printer Offline': 6, 'Offline': 6,
    'Low paper': 7, 'Low Paper': 7,
};

const HIGH_PRIORITY_TYPES = ['No paper', 'No Paper', 'Service Requested', 'Jammed', 'Paper Jam'];

function calcPriority(errorType) {
    return PRIORITY_MAP[String(errorType || '')] || 7;
}

function isHighPriority(issueType) {
    const s = String(issueType || '').toLowerCase();
    return HIGH_PRIORITY_TYPES.some(h => s.includes(h.toLowerCase()));
}

// ─── Appwrite Messaging Push ──────────────────────────────────────────────────
async function sendViaAppwriteMessaging(messaging, users, FCM_PROVIDER_ID, title, bodyText, data, log, error) {
    try {
        const allUsers = await users.list([Query.limit(100)]);
        const targetIds = [];

        for (const u of allUsers.users) {
            try {
                const targets = await users.listTargets(u.$id);
                for (const t of targets.targets) {
                    if (t.providerType === 'push') {
                        targetIds.push(t.$id);
                    }
                }
            } catch (_) { }
        }

        if (targetIds.length === 0) {
            log('[Messaging] No registered push targets found.');
            return false;
        }

        log(`[Messaging] Dispatching to ${targetIds.length} target(s): "${title}"`);

        await messaging.createPush(
            ID.unique(),      // messageId
            title,            // title
            bodyText,         // body
            [],               // topics
            [],               // users
            targetIds,        // targets
            data,             // data payload
            'tasks',          // action
            undefined,        // image (FIXED: was empty string)
            undefined,        // icon (FIXED: was empty string)
            'default',        // sound
            undefined,        // color
            'high_priority',  // tag
            1,                // badge
            false             // draft
        );
        log('[Messaging] ✓ Push sent successfully');
        return true;
    } catch (e) {
        error('[Messaging] ✗ Error: ' + e.message);
        return false;
    }
}

// ─── Master notification dispatcher ──────────────────────────────────────────
async function dispatchPushNotification(databases, messaging, users, DATABASE_ID, USERS_COL, FCM_PROVIDER_ID, issueType, doc, log, error) {
    const location = doc.location || doc.building || 'Unknown Location';
    const printerId = doc.printer_id || 'Unknown Printer';
    const priority = calcPriority(issueType);
    const urgency = priority === 1 ? '🚨 CRITICAL' : priority === 2 ? '⚠️ URGENT' : '⚡ HIGH';

    const title = `${urgency}: ${issueType}`;
    const bodyText = `Printer ${printerId} at ${location} needs immediate attention!`;
    
    // Convert all values to strings for FCM data compatibility
    const data = { 
      issueType: String(issueType), 
      printerId: String(printerId), 
      location: String(location), 
      priority: String(priority), 
      screen: 'tasks' 
    };

    log(`[NOTIFY] Dispatching: "${title}"`);
    await sendViaAppwriteMessaging(messaging, users, FCM_PROVIDER_ID, title, bodyText, data, log, error);
}


// ─── Main Handler ─────────────────────────────────────────────────────────────
export default async ({ req, res, log, error }) => {
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);
    const messaging = new Messaging(client);
    const usersApi = new Users(client);

    const DATABASE_ID     = '69cbdded00392d03962c';
    const TASKS_COL       = 'maintenance';
    const USERS_COL       = 'users_collection';
    const FCM_PROVIDER_ID = '69d4d2ce0027660c1fe2'; // Provider ID from Messaging tab

    const path   = req.path   || '/';
    const method = req.method || 'GET';

    let payload = {};
    if (req.body) {
        try {
            payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } catch (e) { }
    }

    log(`--> ${method} ${path}`);

    // Trigger on DB Event (create/update)
    if (path === '/') {
        const eventHeader = req.headers?.['x-appwrite-event'] || '';
        const isMaintenance = eventHeader.includes('maintenance');
        const isChange = eventHeader.includes('create') || eventHeader.includes('update');

        if (isMaintenance && isChange) {
            const errorType = payload.error_type || '';
            if (isHighPriority(errorType)) {
                log(`[Event] HIGH PRIORITY detected (${errorType})`);
                await dispatchPushNotification(databases, messaging, usersApi, DATABASE_ID, USERS_COL, FCM_PROVIDER_ID, errorType, payload, log, error);
            }
        }
        return res.json({ success: true });
    }

    try {
        if (path === '/ping') {
            return res.json({ status: 'Online', time: new Date().toISOString(), providerId: FCM_PROVIDER_ID });
        }

        if (path === '/users' && method === 'GET') {
            const result = await databases.listDocuments(DATABASE_ID, USERS_COL, [Query.limit(100)]);
            return res.json({ success: true, users: result.documents });
        }

        if (path === '/tasks' && method === 'GET') {
            const result = await databases.listDocuments(DATABASE_ID, TASKS_COL, [Query.limit(100), Query.orderDesc('$createdAt')]);
            return res.json({ success: true, tasks: result.documents });
        }

        // Register push token (Target)
        if (path === '/saveToken' && method === 'POST') {
            const { userId, fcmToken } = payload;
            if (!userId || !fcmToken) return res.json({ error: 'Missing data' }, 400);

            log(`[Token] Registering for user ${userId}`);
            
            // 1. Appwrite Push Target (Mandatory for Messaging)
            try {
                await usersApi.createTarget(userId, ID.unique(), 'push', fcmToken, FCM_PROVIDER_ID);
                log('[Token] ✓ Registered in Appwrite');
            } catch (e) { log(`[Token] Target exist: ${e.message}`); }

            // 2. DB Copy (For backup/reference)
            try {
                await databases.updateDocument(DATABASE_ID, USERS_COL, userId, { fcmToken: [fcmToken] });
                log('[Token] ✓ Saved in DB');
            } catch (e) { }

            return res.json({ success: true });
        }

        return res.json({ error: 'Not found' }, 404);

    } catch (e) {
        error('Error: ' + e.message);
        return res.json({ error: e.message }, 500);
    }
};
