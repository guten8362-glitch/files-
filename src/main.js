import { Client, Databases, Users, Messaging, ID, Query } from 'node-appwrite';

/**
 * SupportA4 Backend — node-appwrite v14 (ES Module)
 *
 * FIXES:
 * - USERS_COL was 'users' → corrected to 'users_collection'
 * - messaging.createPush() had wrong param order (was sending as draft=true, never delivered)
 * - Added direct FCM HTTP API as bulletproof fallback
 * - /saveToken now saves raw token in DB AND registers Appwrite push target
 */

// ─── Priority map: error_type → numeric rank (1=most urgent) ─────────────────
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

// ─── Direct FCM HTTP (Legacy API) — GUARANTEED delivery fallback ──────────────
async function sendViaFCMDirect(tokens, title, body, data, log, error) {
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey) {
    error('[FCM-Direct] FCM_SERVER_KEY is not set in environment variables!');
    return false;
  }
  if (!tokens || tokens.length === 0) {
    log('[FCM-Direct] No raw FCM tokens available, skipping direct push.');
    return false;
  }

  const payload = {
    registration_ids: tokens,
    priority: 'high',
    notification: {
      title,
      body,
      sound: 'default',
      android_channel_id: 'high_priority_tasks',
    },
    android: {
      priority: 'high',
      notification: {
        channel_id: 'high_priority_tasks',
        priority: 'max',
        default_vibrate_timings: false,
        vibrate_timings: ['0s', '0.5s', '0.5s', '0.5s'],
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
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key=${serverKey}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    log(`[FCM-Direct] success=${result.success} failure=${result.failure}`);
    if (result.results) {
      result.results.forEach((r, i) => {
        if (r.error) error(`[FCM-Direct] Token[${i}] error: ${r.error}`);
      });
    }
    return result.success > 0;
  } catch (e) {
    error('[FCM-Direct] fetch failed: ' + e.message);
    return false;
  }
}

// ─── Appwrite Messaging push → fallback to FCM direct ────────────────────────
async function sendHighPriorityAlert(databases, messaging, users, DATABASE_ID, USERS_COL, FCM_PROVIDER_ID, issueType, doc, log, error) {
  const location  = doc.location  || doc.building   || 'Unknown Location';
  const printerId = doc.printer_id || doc.printerId  || 'Unknown Printer';
  const priority  = calcPriority(issueType);
  const urgency   = priority === 1 ? '🚨 CRITICAL' : priority === 2 ? '⚠️ URGENT' : '⚡ HIGH';

  const title = `${urgency}: ${issueType}`;
  const body  = `Printer ${printerId} at ${location} needs immediate attention!`;
  const data  = { issueType, printerId, location, priority: String(priority), screen: 'tasks' };

  log(`[FCM] Sending alert: "${title}"`);

  // ── Path 1: Appwrite Messaging (registered push targets) ─────────────────
  let appwriteSuccess = false;
  try {
    const allUsers = await users.list();
    const targetIds = [];

    for (const u of allUsers.users) {
      try {
        const targets = await users.listTargets(u.$id);
        for (const t of targets.targets) {
          if (t.providerType === 'push') targetIds.push(t.$id);
        }
      } catch (_) { /* user has no targets */ }
    }

    log(`[FCM] Found ${targetIds.length} Appwrite push target(s)`);

    if (targetIds.length > 0) {
      // node-appwrite v14 createPush signature:
      // createPush(messageId, title, body, topics?, users?, targets?,
      //            data?, action?, image?, icon?, sound?,
      //            color?, tag?, badge?, draft?, scheduledAt?)
      await messaging.createPush(
        ID.unique(),   // messageId
        title,         // title
        body,          // body
        [],            // topics
        [],            // users  (not using user-level, using targets)
        targetIds,     // targets ← the registered push target IDs
        data,          // data
        undefined,     // action
        undefined,     // image
        undefined,     // icon
        'default',     // sound
        undefined,     // color
        undefined,     // tag
        undefined,     // badge
        false,         // draft ← MUST be false to actually send!
        undefined      // scheduledAt
      );
      log(`[FCM] Appwrite push dispatched to ${targetIds.length} target(s)`);
      appwriteSuccess = true;
    }
  } catch (e) {
    error('[FCM] Appwrite Messaging failed: ' + e.message);
  }

  // ── Path 2: Direct FCM HTTP (as GUARANTEED fallback) ─────────────────────
  // Always run this so notifications reach devices even if Appwrite Messaging fails.
  try {
    const userDocs = await databases.listDocuments(DATABASE_ID, USERS_COL, [Query.limit(100)]);
    const rawTokens = userDocs.documents
      .flatMap(d => Array.isArray(d.fcmToken) ? d.fcmToken : (d.fcmToken ? [d.fcmToken] : []))
      .filter(t => typeof t === 'string' && t.length > 10);

    log(`[FCM-Direct] Found ${rawTokens.length} raw FCM token(s) in ${USERS_COL}`);
    if (rawTokens.length > 0) {
      await sendViaFCMDirect(rawTokens, title, body, data, log, error);
    }
  } catch (e) {
    error('[FCM-Direct] Token fetch failed: ' + e.message);
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases  = new Databases(client);
  const messaging  = new Messaging(client);
  const usersApi   = new Users(client);

  const DATABASE_ID    = '69cbdded00392d03962c';
  const TASKS_COL      = 'maintenance';        // ← Real tasks collection
  const USERS_COL      = 'users_collection';   // ← Fixed: was 'users', wrong!
  const PRINTERS_COL   = 'printers';
  const FCM_PROVIDER_ID = '69d4d2ce0027660c1fe2';

  const path   = req.path || '/';
  const method = req.method || 'GET';

  let payload = {};
  if (req.body) {
    try {
      payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (e) {
      log('Payload parse failed, using empty object');
    }
  }

  log(`API CALL: ${method} ${path}`);

  // ── Root "/" — Appwrite Database Event Trigger ────────────────────────────
  // Fires when a new document is created in 'maintenance' collection.
  // Configure in Appwrite Console → Functions → Events:
  //   databases.*.collections.maintenance.documents.*.create
  if (path === '/') {
    const eventType = req.headers?.['x-appwrite-event'] || '';
    if (eventType.includes('databases') && eventType.includes('maintenance') && eventType.includes('create')) {
      try {
        const doc = payload;
        const errorType = doc.error_type || '';
        log(`[Event] New maintenance doc: error_type=${errorType}`);

        if (isHighPriority(errorType)) {
          log(`[Event] High-priority detected, sending FCM alert...`);
          await sendHighPriorityAlert(databases, messaging, usersApi, DATABASE_ID, USERS_COL, FCM_PROVIDER_ID, errorType, doc, log, error);
        } else {
          log(`[Event] Priority not high enough for notification (${errorType})`);
        }
      } catch (e) {
        error('[Event] Handler failed: ' + e.message);
      }
    }
    return res.json({ success: true, message: 'Event received' });
  }

  try {
    // ── GET /ping ─────────────────────────────────────────────────────────
    if (path === '/ping') {
      return res.json({ success: true, message: 'SupportA4 Backend Online', timestamp: new Date().toISOString() });
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

      // Sort by numeric priority ASC (1=most urgent), then oldest first
      const sorted = result.documents.sort((a, b) => {
        const pA = calcPriority(a.error_type);
        const pB = calcPriority(b.error_type);
        if (pA !== pB) return pA - pB;
        return new Date(a.startTime || a.$createdAt).getTime() -
          new Date(b.startTime || b.$createdAt).getTime();
      });

      return res.json({ success: true, tasks: sorted });
    }

    // ── POST /tasks — create task + notify ────────────────────────────────
    if (path === '/tasks' && method === 'POST') {
      const issueType = Array.isArray(payload.issueType) ? payload.issueType[0] : (payload.issueType || 'Unknown');

      const doc = await databases.createDocument(DATABASE_ID, TASKS_COL, ID.unique(), {
        printer_id:   payload.printerId || 'Unknown',
        location:     payload.location  || 'Unknown',
        error_type:   issueType,
        building:     payload.building  || '-',
        floor:        payload.floor     || '-',
        printerFixed: false,
        startTime:    new Date().toISOString(),
      });

      log(`[Tasks] Created task ${doc.$id} | issue=${issueType}`);

      if (isHighPriority(issueType)) {
        log(`[Tasks] High-priority task → sending FCM notifications...`);
        sendHighPriorityAlert(databases, messaging, usersApi, DATABASE_ID, USERS_COL, FCM_PROVIDER_ID, issueType, doc, log, error)
          .catch(e => error('[Tasks] Background notification failed: ' + e.message));
      }

      return res.json({ success: true, data: doc });
    }

    // ── POST /saveToken — register FCM token ──────────────────────────────
    if (path === '/saveToken' && method === 'POST') {
      const { userId, fcmToken } = payload;
      if (!userId || !fcmToken) {
        return res.json({ error: 'Missing userId or fcmToken' }, 400);
      }

      // 1. Register in Appwrite Users (for Appwrite Messaging)
      try {
        await usersApi.createTarget(userId, ID.unique(), 'push', fcmToken, undefined, FCM_PROVIDER_ID);
        log(`[Token] Appwrite push target registered for user ${userId}`);
      } catch (e) {
        // Might already exist or user not in Appwrite Auth — not fatal
        log('[Token] createTarget warning: ' + e.message);
      }

      // 2. Save raw token in users_collection (for direct FCM fallback)
      try {
        const userDoc = await databases.getDocument(DATABASE_ID, USERS_COL, userId);
        const existing = Array.isArray(userDoc.fcmToken) ? userDoc.fcmToken : 
                         (userDoc.fcmToken ? [userDoc.fcmToken] : []);
        if (!existing.includes(fcmToken)) {
          await databases.updateDocument(DATABASE_ID, USERS_COL, userId, {
            fcmToken: [...existing, fcmToken],
          });
          log(`[Token] Saved raw FCM token for user ${userId} in ${USERS_COL}`);
        } else {
          log(`[Token] Token already stored for user ${userId}`);
        }
      } catch (e) {
        error('[Token] DB update failed: ' + e.message);
      }

      return res.json({ success: true });
    }

    // ── PUT /complete/:taskId ─────────────────────────────────────────────
    if (path.startsWith('/complete/') && (method === 'PUT' || method === 'POST')) {
      const taskId = path.replace('/complete/', '');
      await databases.updateDocument(DATABASE_ID, TASKS_COL, taskId, {
        printerFixed: true,
        endTime:      new Date().toISOString(),
        employee_one: payload.employeeId || null,
        notes:        payload.notes      || '',
      });
      log(`[Complete] Task ${taskId} marked as fixed`);
      return res.json({ success: true, message: 'Task marked as fixed' });
    }

    // ── POST /notifyAll — test broadcast push to all devices ──────────────
    if (path === '/notifyAll' && method === 'POST') {
      const title   = payload.title   || 'SupportA4 Alert';
      const body    = payload.message || 'New task available';
      const mockDoc = { location: 'Test', printer_id: 'Test', error_type: 'Test' };
      await sendHighPriorityAlert(databases, messaging, usersApi, DATABASE_ID, USERS_COL, FCM_PROVIDER_ID, title, mockDoc, log, error);
      return res.json({ success: true, message: 'Broadcast sent' });
    }

    return res.json({ success: false, error: 'Route not found: ' + path }, 404);

  } catch (e) {
    error('RUNTIME ERROR: ' + e.message);
    return res.json({ success: false, error: e.message }, 500);
  }
};
