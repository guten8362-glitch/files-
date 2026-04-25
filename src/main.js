import { Client, Databases, Users, Messaging, ID, Query } from 'node-appwrite';

/**
 * SupportA4 Backend — One Single Notification Path:
 * uses Appwrite's built-in Messaging service.
 */

// ─── Priority & Labels ────────────────────────────────────────────────────────
const PRIORITY_RULES = [
    { type: 'No paper', priority: 1, label: '🚨 CRITICAL', color: 'High' },
    { type: 'Service Requested', priority: 2, label: '⚠️ HIGH', color: 'High' },
    { type: 'Jammed', priority: 3, label: '🟠 JAMMED', color: 'Orange' },
    { type: 'Paper Jam', priority: 3, label: '🟠 JAMMED', color: 'Orange' },
    { type: 'Door Opened', priority: 4, label: '⚡ IMMEDIATE', color: 'Orange' },
    { type: 'No toner ink', priority: 5, label: '🔵 CRITICAL', color: 'Blue' },
    { type: 'No Toner', priority: 5, label: '🔵 CRITICAL', color: 'Blue' },
    { type: 'Printer Offline', priority: 5, label: '🔵 CRITICAL', color: 'Blue' },
    { type: 'Offline', priority: 5, label: '🔵 CRITICAL', color: 'Blue' },
    { type: 'Low paper', priority: 6, label: '✅ READY', color: 'Yellow' }
];

const ERROR_CODE_MAP = {
    '5000': 'Service Requested',
    '5001': 'No paper',
    '5002': 'Jammed',
    '5003': 'No Toner',
    '5004': 'Door Opened',
    '5005': 'Low paper',
    '5006': 'Printer Offline'
};

function getMappedIssueType(value) {
    const code = String(value || '').trim();
    return ERROR_CODE_MAP[code] || value;
}

function getRule(rawType) {
    const issueType = getMappedIssueType(rawType);
    const s = String(issueType || '').toLowerCase();
    return PRIORITY_RULES.find(r => s.includes(r.type.toLowerCase())) || { priority: 7, label: '⚡ TASK', color: 'Grey' };
}

function isHighPriority(issueType) {
    // Notify for almost everything requested except Low Paper maybe? 
    // Usually everything priority 1-5 warrants a push.
    return getRule(issueType).priority <= 5;
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

        log(`[Messaging] Sending to ${targetIds.length} target(s)...`);

        await messaging.createPush(
            ID.unique(),      // messageId
            title,            // title
            bodyText,         // body
            [],               // topics
            [],               // users
            targetIds,        // targets
            data,             // data payload
            'tasks',          // action
            undefined,        // image
            undefined,        // icon
            'notification',   // sound (Resource: notification.wav)
            undefined,        // color
            'maintenance',    // tag
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

// ─── Direct FCM Notification (For Background Sound) ──────────────────────────
async function sendDirectFCM(fcmTokens, title, body, data, log, error) {
    const serverKey = process.env.FCM_SERVER_KEY;
    if (!serverKey) {
        log('[FCM] Skipping direct push: FCM_SERVER_KEY is not set in environment variables.');
        return false;
    }

    const payload = {
        registration_ids: fcmTokens,
        priority: 'high',
        notification: {
            title,
            body,
            sound: 'notification',
            android_channel_id: 'priority_alerts_v3'
        },
        android: {
            priority: 'high',
            notification: {
                channel_id: 'priority_alerts_v3',
                sound: 'notification',
                default_vibrate_timings: false,
                vibrate_timings: ['0s', '0.5s', '0.5s', '0.5s'],
                notification_priority: 'PRIORITY_MAX'
            }
        },
        data: {
            ...data,
            channelId: 'priority_alerts_v3',
            android_channel_id: 'priority_alerts_v3'
        }
    };

    try {
        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `key=${serverKey}`
            },
            body: JSON.stringify(payload)
        });
        const resJson = await response.json();
        log(`[FCM] Direct push success: ${resJson.success}, failure: ${resJson.failure}`);
        return resJson.success > 0;
    } catch (e) {
        error(`[FCM] Direct push error: ${e.message}`);
        return false;
    }
}

// ─── Master notification dispatcher ──────────────────────────────────────────
async function dispatchPushNotification(databases, messaging, users, DATABASE_ID, USERS_COL, FCM_PROVIDER_ID, issueType, doc, log, error) {
    const location = (doc.location || doc.building || 'UNKNOWN LOCATION').toUpperCase();
    const printerId = (doc.printer_id || 'UNKNOWN PRINTER').toUpperCase();
    const rule = getRule(issueType);

    const title = `${rule.label}: ${String(issueType).toUpperCase()}`;
    const bodyText = `📍 ${location}\n🖨️ PRINTER: ${printerId}\nNeeds intervention now.`;

    const data = {
        issueType: String(issueType),
        printerId: String(printerId),
        location: String(location),
        priority: String(rule.priority),
        screen: 'tasks'
    };

    log(`[NOTIFY] Dispatching background-sound-alert via Direct FCM (v3)`);
    
    // 1. Get all saved tokens from the DB
    try {
        const userDocs = await databases.listDocuments(DATABASE_ID, USERS_COL, [Query.limit(100)]);
        const tokens = userDocs.documents
            .flatMap(d => Array.isArray(d.fcmToken) ? d.fcmToken : [])
            .filter(t => t && t.length > 10);
            
        if (tokens.length > 0) {
            await sendDirectFCM(tokens, title, bodyText, data, log, error);
        } else {
            log('[NOTIFY] No tokens found in DB for direct FCM.');
        }
    } catch (e) {
        error(`[NOTIFY] Token fetch error: ${e.message}`);
    }

    // 2. Also send via standard Messaging for history/record
    await sendViaAppwriteMessaging(messaging, users, FCM_PROVIDER_ID, title, bodyText, { ...data, channelId: 'priority_alerts_v3' }, log, error);
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

    const DATABASE_ID = '69cbdded00392d03962c';
    const TASKS_COL = 'maintenance';
    const USERS_COL = 'users_collection';
    const FCM_PROVIDER_ID = '69d4d2ce0027660c1fe2'; // Provider ID from Messaging tab

    const path = req.path || '/';
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
            // Check multiple possible fields for the error code
            const rawError = payload.error_type || payload.error_code || payload.flag || payload.errorCode || payload.issue_type || '';
            const rule = getRule(rawError);
            const errorType = getMappedIssueType(rawError);

            if (rule.priority <= 5) {
                log(`[Event] HIGH PRIORITY detected: ${errorType} (P${rule.priority}) [Original: ${rawError}]`);
                await dispatchPushNotification(databases, messaging, usersApi, DATABASE_ID, USERS_COL, FCM_PROVIDER_ID, errorType, payload, log, error);
            } else {
                log(`[Event] Normal priority: ${errorType} (P${rule.priority})`);
            }
        }
        return res.json({ success: true });
    }

    try {
        if (path === '/ping') {
            return res.json({ status: 'Online', time: new Date().toISOString(), providerId: FCM_PROVIDER_ID });
        }
        
        // Register Google/OTP user in `users_collection` securely on first login
        if (path === '/syncUser' && method === 'POST') {
            const { userId, email, name } = payload;
            try {
                await databases.getDocument(DATABASE_ID, USERS_COL, userId);
            } catch (err) {
                // If the user document throws a 404 meaning missing, gently create it:
                await databases.createDocument(DATABASE_ID, USERS_COL, userId, {
                    email: email || '',
                    name: name || 'Technician',
                    fcmToken: []
                });
                log(`[SyncUser] Created new profile for user ${userId}`);
            }
            return res.json({ success: true });
        }

        // Force-delete sessions for a user (used for re-login recovery)
        if (path === '/deleteUserSessions' && method === 'POST') {
            const { userId } = payload;
            if (!userId) return res.json({ error: 'Missing userId' }, 400);
            try {
                await usersApi.deleteSessions(userId);
                log(`[DeleteSessions] ✓ Cleared all sessions for user ${userId}`);
                return res.json({ success: true });
            } catch (e) {
                error(`[DeleteSessions] Error: ${e.message}`);
                return res.json({ error: e.message }, 500);
            }
        }

        if (path === '/users' && method === 'GET') {
            const result = await databases.listDocuments(DATABASE_ID, USERS_COL, [Query.limit(100)]);
            return res.json({ success: true, users: result.documents });
        }

        if (path === '/tasks' && method === 'GET') {
            const result = await databases.listDocuments(DATABASE_ID, TASKS_COL, [Query.limit(100), Query.orderDesc('$createdAt')]);
            
            // Map the tasks to include human-readable error types and priorities
            const mappedTasks = result.documents.map(doc => {
                const rawError = doc.error_type || doc.error_code || doc.flag || doc.errorCode || '';
                const mappedType = getMappedIssueType(rawError);
                const rule = getRule(rawError);
                return { 
                    ...doc, 
                    error_type: mappedType, // Overwrite with human-readable string
                    priority_level: rule.priority,
                    priority_label: rule.label
                };
            });

            return res.json({ success: true, tasks: mappedTasks });
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
