import { Client, Databases, Users, Messaging, ID, Query } from 'node-appwrite';
import { createSign } from 'crypto'; // Built-in Node.js — no install needed

/**
 * SupportA4 Backend — node-appwrite v14 (ES Module)
 *
 * FCM PUSH — 3 paths tried in order:
 *   1. FCM HTTP V1 API  → uses GOOGLE_SERVICE_ACCOUNT_JSON env var (recommended)
 *   2. FCM Legacy API   → uses FCM_SERVER_KEY env var (if Legacy API enabled in Firebase)
 *   3. Appwrite Messaging → uses registered push targets
 *
 * COLLECTIONS:
 *   maintenance      → tasks
 *   printers         → printer health
 *   users_collection → technicians with fcmToken field
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

// ─── FCM V1 API: Get OAuth2 Access Token from Service Account ────────────────
// Uses GOOGLE_SERVICE_ACCOUNT_JSON env var (the downloaded .json file content)
// No external libraries — uses built-in Node.js crypto to sign the JWT
async function getGoogleOAuthToken(log, error) {
    const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!jsonStr) return null;

    try {
        const sa = JSON.parse(jsonStr);
        const now = Math.floor(Date.now() / 1000);
        const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
        const claim = Buffer.from(JSON.stringify({
            iss: sa.client_email,
            scope: 'https://www.googleapis.com/auth/firebase.messaging',
            aud: 'https://oauth2.googleapis.com/token',
            exp: now + 3600,
            iat: now,
        })).toString('base64url');

        const signing = `${header}.${claim}`;
        const sign = createSign('RSA-SHA256');
        sign.update(signing);
        sign.end();
        const signature = sign.sign(sa.private_key, 'base64url');
        const jwt = `${signing}.${signature}`;

        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
        });
        const tokenJson = await tokenRes.json();

        if (tokenJson.access_token) {
            log('[FCM-V1] ✓ OAuth2 token obtained');
            return { token: tokenJson.access_token, projectId: sa.project_id };
        }
        error('[FCM-V1] Token exchange failed: ' + JSON.stringify(tokenJson));
        return null;
    } catch (e) {
        error('[FCM-V1] getGoogleOAuthToken error: ' + e.message);
        return null;
    }
}

// ─── FCM V1 API: Send push notification (modern, replaces legacy) ─────────────
// Each token requires a separate request in V1 API
async function sendFCMv1(tokens, title, bodyText, data, log, error) {
    const auth = await getGoogleOAuthToken(log, error);
    if (!auth) return 0;

    log(`[FCM-V1] Sending to ${tokens.length} token(s): "${title}"`);
    let successCount = 0;

    for (const token of tokens) {
        try {
            const response = await fetch(
                `https://fcm.googleapis.com/v1/projects/${auth.projectId}/messages:send`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${auth.token}`,
                    },
                    body: JSON.stringify({
                        message: {
                            token,
                            notification: { title, body: bodyText },
                            android: {
                                priority: 'HIGH',
                                notification: {
                                    channel_id: 'high_priority_tasks',
                                    notification_priority: 'PRIORITY_MAX',
                                    visibility: 'PUBLIC',
                                    sound: 'default',
                                    vibrate_timings: ['0s', '0.5s', '0.5s', '0.5s'],
                                },
                            },
                            data: Object.fromEntries(
                                Object.entries({ ...data }).map(([k, v]) => [k, String(v)])
                            ),
                        },
                    }),
                }
            );
            const result = await response.json();
            if (result.name) {
                log(`[FCM-V1] ✓ Sent to token ...${token.slice(-8)}: ${result.name}`);
                successCount++;
            } else {
                error(`[FCM-V1] ✗ Token ...${token.slice(-8)}: ${JSON.stringify(result.error || result)}`);
            }
        } catch (e) {
            error(`[FCM-V1] ✗ Token ...${token.slice(-8)} threw: ${e.message}`);
        }
    }

    log(`[FCM-V1] Done: ${successCount}/${tokens.length} delivered`);
    return successCount;
}

// ─── FCM Legacy API: Send push (needs FCM_SERVER_KEY) ────────────────────────
// Only works if you enable "Cloud Messaging API (Legacy)" in Firebase Console
async function sendFCMLegacy(tokens, title, bodyText, data, log, error) {

    const serverKey = process.env.FCM_SERVER_KEY;
    if (!serverKey) {
        log('[FCM-Legacy] FCM_SERVER_KEY not set, skipping.');
        return 0;
    }
    if (!tokens || tokens.length === 0) {
        log('[FCM-Legacy] No tokens, skipping.');
        return 0;
    }

    log(`[FCM-Legacy] Sending to ${tokens.length} token(s): "${title}"`);

    const payload = {
        registration_ids: tokens,
        priority: 'high',
        notification: { title, body: bodyText, sound: 'default', android_channel_id: 'high_priority_tasks' },
        android: {
            priority: 'high',
            notification: {
                channel_id: 'high_priority_tasks',
                notification_priority: 'PRIORITY_MAX',
                visibility: 'PUBLIC',
                sound: 'default',
            },
        },
        data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
    };

    try {
        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `key=${serverKey}` },
            body: JSON.stringify(payload),
        });
        const result = await response.json();
        log(`[FCM-Legacy] success=${result.success} failure=${result.failure}`);
        if (result.results) {
            result.results.forEach((r, i) => {
                if (r.message_id) log(`[FCM-Legacy] Token[${i}] ✓`);
                else if (r.error) error(`[FCM-Legacy] Token[${i}] ✗ ${r.error}`);
            });
        }
        return result.success || 0;
    } catch (e) {
        error('[FCM-Legacy] fetch threw: ' + e.message);
        return 0;
    }
}

// ─── Appwrite Messaging Push ──────────────────────────────────────────────────
// Uses Appwrite's built-in push system. Requires:
//   1. FCM Provider configured in Appwrite Console → Messaging → Providers
//   2. Device registered via users.createTarget()
// node-appwrite v14 createPush signature:
//   createPush(messageId, title, body, topics?, users?, targets?,
//              data?, action?, image?, icon?, sound?,
//              color?, tag?, badge?, draft?, scheduledAt?)
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
                        log(`[FCM-Appwrite] Found push target: ${t.$id} for user ${u.$id}`);
                    }
                }
            } catch (_) { /* user has no targets registered */ }
        }

        if (targetIds.length === 0) {
            log('[FCM-Appwrite] No registered push targets found. Ensure /saveToken was called after login.');
            return false;
        }

        log(`[FCM-Appwrite] Sending to ${targetIds.length} target(s)...`);

        await messaging.createPush(
            ID.unique(),  // messageId
            title,        // title
            bodyText,     // body
            [],           // topics
            [],           // users (using targets instead)
            targetIds,    // targets ← push target IDs from users.createTarget()
            data,         // data payload
            undefined,    // action
            undefined,    // image
            undefined,    // icon
            'default',    // sound
            undefined,    // color
            undefined,    // tag
            undefined,    // badge
            false,        // draft ← MUST be false to send immediately!
            undefined     // scheduledAt
        );

        log(`[FCM-Appwrite] ✓ Push dispatched to ${targetIds.length} target(s)`);
        return true;
    } catch (e) {
        error('[FCM-Appwrite] Failed: ' + e.message);
        return false;
    }
}

// ─── Master notification dispatcher ──────────────────────────────────────────
// Tries FCM V1 → FCM Legacy → Appwrite Messaging (in order of reliability)
async function dispatchPushNotification(databases, messaging, users, DATABASE_ID, USERS_COL, FCM_PROVIDER_ID, issueType, doc, log, error) {
    const location = doc.location || doc.building || 'Unknown Location';
    const printerId = doc.printer_id || 'Unknown Printer';
    const priority = calcPriority(issueType);
    const urgency = priority === 1 ? '🚨 CRITICAL' : priority === 2 ? '⚠️ URGENT' : '⚡ HIGH';

    const title = `${urgency}: ${issueType}`;
    const bodyText = `Printer ${printerId} at ${location} needs immediate attention!`;
    const data = { issueType, printerId, location, priority: String(priority), screen: 'tasks' };

    log(`[NOTIFY] ─── Push notification triggered ───`);
    log(`[NOTIFY] Title: "${title}"`);
    log(`[NOTIFY] Body:  "${bodyText}"`);
    log(`[NOTIFY] Env: GOOGLE_SERVICE_ACCOUNT_JSON=${!!process.env.GOOGLE_SERVICE_ACCOUNT_JSON}, FCM_SERVER_KEY=${!!process.env.FCM_SERVER_KEY}`);

    // Fetch all raw FCM tokens from users_collection
    let rawTokens = [];
    try {
        const userDocs = await databases.listDocuments(DATABASE_ID, USERS_COL, [Query.limit(100)]);
        rawTokens = userDocs.documents.flatMap(d => {
            if (Array.isArray(d.fcmToken)) return d.fcmToken;
            if (d.fcmToken && typeof d.fcmToken === 'string') return [d.fcmToken];
            return [];
        }).filter(t => typeof t === 'string' && t.length > 20);
        log(`[NOTIFY] Found ${rawTokens.length} token(s) across ${userDocs.documents.length} user(s)`);
    } catch (e) {
        error('[NOTIFY] Failed to fetch tokens: ' + e.message);
    }

    // Path 1: FCM V1 API (Service Account — modern, recommended)
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON && rawTokens.length > 0) {
        log('[NOTIFY] Path 1: FCM V1 API (Service Account)...');
        const v1Count = await sendFCMv1(rawTokens, title, bodyText, data, log, error);
        if (v1Count > 0) { log(`[NOTIFY] ✓ V1 delivered to ${v1Count} device(s).`); return; }
    }

    // Path 2: FCM Legacy API (needs FCM_SERVER_KEY + Legacy API enabled in Firebase)
    if (process.env.FCM_SERVER_KEY && rawTokens.length > 0) {
        log('[NOTIFY] Path 2: FCM Legacy API (Server Key)...');
        const legCount = await sendFCMLegacy(rawTokens, title, bodyText, data, log, error);
        if (legCount > 0) { log(`[NOTIFY] ✓ Legacy delivered to ${legCount} device(s).`); return; }
    }

    // Path 3: Appwrite Messaging (push targets registered via /saveToken)
    log('[NOTIFY] Path 3: Appwrite Messaging...');
    await sendViaAppwriteMessaging(messaging, users, FCM_PROVIDER_ID, title, bodyText, data, log, error);
    log('[NOTIFY] ─── Done ───');
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
export default async ({ req, res, log, error }) => {
    const client = new Client()
        .setEndpoint(
            process.env.APPWRITE_ENDPOINT ||
            process.env.APPWRITE_FUNCTION_ENDPOINT ||
            'https://nyc.cloud.appwrite.io/v1'
        )
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);
    const messaging = new Messaging(client);
    const usersApi = new Users(client);

    const DATABASE_ID = '69cbdded00392d03962c';
    const TASKS_COL = 'maintenance';
    const USERS_COL = 'users_collection';
    const PRINTERS_COL = 'printers';
    const FCM_PROVIDER_ID = '69d4d2ce0027660c1fe2'; // Appwrite → Messaging → Providers → copy ID

    const path = req.path || '/';
    const method = req.method || 'GET';

    let payload = {};
    if (req.body) {
        try {
            payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } catch (e) {
            log('Body parse failed, using empty object');
        }
    }

    log(`--> ${method} ${path}`);

    // ── "/" — Appwrite DB Event trigger ───────────────────────────────────────
    // Setup: Appwrite Console → Functions → Events:
    //   databases.69cbdded00392d03962c.collections.maintenance.documents.*.create
    //   databases.69cbdded00392d03962c.collections.maintenance.documents.*.update
    if (path === '/') {
        const eventHeader = req.headers?.['x-appwrite-event'] || '';
        log(`[Event] x-appwrite-event: ${eventHeader || '(none)'}`);

        const isMaintenanceEvent = eventHeader.includes('maintenance');
        const isDataChange = eventHeader.includes('create') || eventHeader.includes('update');

        if (isMaintenanceEvent && isDataChange) {
            const doc = payload;
            const errorType = doc.error_type || '';
            log(`[Event] Doc Action: ${eventHeader.split('.').pop()} | error_type="${errorType}"`);

            // We only notify if it's currently high priority
            if (isHighPriority(errorType)) {
                log('[Event] HIGH PRIORITY → dispatching notifications...');
                await dispatchPushNotification(
                    databases, messaging, usersApi,
                    DATABASE_ID, USERS_COL, FCM_PROVIDER_ID,
                    errorType, doc, log, error
                );
            } else {
                log(`[Event] Priority check: "${errorType}" is not high priority.`);
            }
        }
        return res.json({ success: true, event: 'processed' });
    }

    try {

        // ── GET /ping ─────────────────────────────────────────────────────────
        if (path === '/ping') {
            const hasV1 = !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
            const hasLeg = !!process.env.FCM_SERVER_KEY;
            return res.json({
                success: true,
                message: 'SupportA4 Backend Online',
                timestamp: new Date().toISOString(),
                fcmMethod: hasV1 ? 'V1 (Service Account) ✓' : hasLeg ? 'Legacy (Server Key) ✓' : 'Appwrite Messaging only',
                GOOGLE_SERVICE_ACCOUNT_JSON: hasV1,
                FCM_SERVER_KEY: hasLeg,
                APPWRITE_API_KEY: !!process.env.APPWRITE_API_KEY,
            });
        }

        // ── GET /users ────────────────────────────────────────────────────────
        if (path === '/users' && method === 'GET') {
            const result = await databases.listDocuments(DATABASE_ID, USERS_COL, [Query.limit(100)]);
            return res.json({ success: true, users: result.documents });
        }

        // ── GET /printers ─────────────────────────────────────────────────────
        if (path === '/printers' && method === 'GET') {
            const result = await databases.listDocuments(DATABASE_ID, PRINTERS_COL, [Query.limit(100)]);
            return res.json({ success: true, printers: result.documents });
        }

        // ── GET /tasks ────────────────────────────────────────────────────────
        if (path === '/tasks' && method === 'GET') {
            const result = await databases.listDocuments(DATABASE_ID, TASKS_COL, [
                Query.limit(100),
                Query.orderDesc('$createdAt'),
            ]);

            const sorted = result.documents.sort((a, b) => {
                const pA = calcPriority(a.error_type);
                const pB = calcPriority(b.error_type);
                if (pA !== pB) return pA - pB;
                const tA = new Date(a.startTime || a.$createdAt).getTime();
                const tB = new Date(b.startTime || b.$createdAt).getTime();
                return tA - tB;
            });

            return res.json({ success: true, tasks: sorted });
        }

        // ── POST /tasks — create + notify ─────────────────────────────────────
        if (path === '/tasks' && method === 'POST') {
            const issueType = Array.isArray(payload.issueType)
                ? payload.issueType[0]
                : (payload.issueType || 'Unknown');

            const doc = await databases.createDocument(DATABASE_ID, TASKS_COL, ID.unique(), {
                printer_id: payload.printerId || 'Unknown',
                location: payload.location || 'Unknown',
                error_type: issueType,
                building: payload.building || '-',
                floor: payload.floor || '-',
                printerFixed: false,
                startTime: new Date().toISOString(),
            });

            log(`[Tasks] Created: ${doc.$id} | issue=${issueType}`);

            if (isHighPriority(issueType)) {
                log('[Tasks] High priority → dispatching FCM push...');
                dispatchPushNotification(
                    databases, messaging, usersApi,
                    DATABASE_ID, USERS_COL, FCM_PROVIDER_ID,
                    issueType, doc, log, error
                ).catch(e => error('[Tasks] FCM dispatch error: ' + e.message));
            }

            return res.json({ success: true, data: doc });
        }

        // ── POST /saveToken — register device for push notifications ─────────
        // Per fcm_implementation_guide.md: MUST call users.createTarget() with providerType
        if (path === '/saveToken' && method === 'POST') {
            const { userId, fcmToken } = payload;

            if (!userId || !fcmToken) {
                return res.json({ error: 'Missing userId or fcmToken' }, 400);
            }

            log(`[Token] Registering FCM token for user: ${userId}`);
            log(`[Token] Token preview: ${fcmToken.substring(0, 20)}...`);

            // Step 1: Register as Appwrite push target
            // Per guide: providerType is MANDATORY in Appwrite 1.9+
            try {
                const targetId = ID.unique();
                await usersApi.createTarget(
                    userId,           // userId
                    targetId,         // targetId
                    'push',           // providerType ← MANDATORY (from guide)
                    fcmToken,         // identifier (the FCM token)
                    FCM_PROVIDER_ID,  // providerId (Appwrite FCM provider)
                    `device_${userId.substring(0, 8)}` // name (optional label)
                );
                log(`[Token] ✓ Appwrite push target created: ${targetId}`);
            } catch (e) {
                // This often fails if target already exists — not fatal
                log(`[Token] createTarget note: ${e.message}`);
            }

            // Step 2: Also save raw token string in users_collection.fcmToken
            // This is used by the direct FCM fallback path
            try {
                const userDoc = await databases.getDocument(DATABASE_ID, USERS_COL, userId);
                const existing = Array.isArray(userDoc.fcmToken)
                    ? userDoc.fcmToken
                    : (userDoc.fcmToken ? [userDoc.fcmToken] : []);

                if (!existing.includes(fcmToken)) {
                    await databases.updateDocument(DATABASE_ID, USERS_COL, userId, {
                        fcmToken: [...existing, fcmToken],
                    });
                    log(`[Token] ✓ Raw token saved in ${USERS_COL} for user ${userId}`);
                } else {
                    log(`[Token] Raw token already saved for user ${userId}`);
                }
            } catch (e) {
                error('[Token] DB save failed: ' + e.message);
                // Still return success — Appwrite target registration above is what matters
            }

            return res.json({ success: true });
        }

        // ── PUT/POST /complete/:taskId ─────────────────────────────────────────
        if (path.startsWith('/complete/') && (method === 'PUT' || method === 'POST')) {
            const taskId = path.replace('/complete/', '').trim();
            if (!taskId) return res.json({ error: 'Missing taskId' }, 400);

            await databases.updateDocument(DATABASE_ID, TASKS_COL, taskId, {
                printerFixed: true,
                endTime: new Date().toISOString(),
                employee_one: payload.employeeId || null,
                notes: payload.notes || '',
            });

            log(`[Complete] Task ${taskId} marked as fixed by ${payload.employeeId}`);
            return res.json({ success: true });
        }

        // ── POST /notifyAll — manual broadcast test ────────────────────────────
        if (path === '/notifyAll' && method === 'POST') {
            const title = payload.title || '🔔 SupportA4 Test';
            const bodyTxt = payload.message || 'This is a test notification from SupportA4 backend.';
            const mockDoc = { location: 'Test Location', printer_id: 'TEST-01', error_type: 'No Paper' };

            await dispatchPushNotification(
                databases, messaging, usersApi,
                DATABASE_ID, USERS_COL, FCM_PROVIDER_ID,
                title, mockDoc, log, error
            );

            return res.json({ success: true, message: 'Test broadcast dispatched' });
        }

        // ── Default 404 ───────────────────────────────────────────────────────
        return res.json({ success: false, error: `Route not found: ${method} ${path}` }, 404);

    } catch (e) {
        error('RUNTIME ERROR: ' + e.message + '\n' + e.stack);
        return res.json({ success: false, error: e.message }, 500);
    }
};
