const sdk = require('node-appwrite');

/**
 * Printer Maintenance Backend — Node.js (Appwrite Function)
 *
 * CRITICAL FIX: Sends FCM push notifications directly via Google FCM HTTP v1 API
 * using a Service Account key. This bypasses all Appwrite Messaging limitations.
 *
 * COLLECTIONS:
 *   - maintenance       : Tasks (created by printers, polled by app)
 *   - printers          : Printer health records
 *   - users_collection  : Technicians with fcmToken[] array
 *
 * ROUTES:
 *   GET  /tasks            → List tasks from 'maintenance' collection
 *   GET  /printers         → List printers
 *   GET  /users            → List technicians
 *   POST /tasks            → Create new task + send FCM push for priority ≤ 3
 *   POST /saveToken        → Save FCM device token to user document
 *   PUT  /complete/:id     → Complete a task
 *   POST /notify           → Called by Appwrite DB event trigger for new maintenance docs
 */

// ─────────────────────────────────────────────────────────────────────────────
// Priority map: error_type → numeric priority (1=highest urgency)
// ─────────────────────────────────────────────────────────────────────────────
const PRIORITY_MAP = {
  'No paper': 1, 'No Paper': 1,
  'Service Requested': 2,
  'Jammed': 3, 'Paper Jam': 3,
  'Door Opened': 4,
  'No toner ink': 5, 'No Toner': 5,
  'Printer Offline': 6, 'Offline': 6,
  'Low paper': 7, 'Low Paper': 7,
};

function calcPriority(errorType) {
  return PRIORITY_MAP[String(errorType || '')] || 7;
}

// ─────────────────────────────────────────────────────────────────────────────
// FCM HTTP v1 — Direct push via fetch (no SDK needed)
// ENV var: FCM_SERVER_KEY  (the "Server key" from Firebase Console → Project settings → Cloud Messaging)
// ─────────────────────────────────────────────────────────────────────────────
async function sendFCMToTokens(tokens, title, body, data = {}) {
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey) {
    console.error('[FCM] FCM_SERVER_KEY env var is missing! Cannot send push.');
    return;
  }
  if (!tokens || tokens.length === 0) {
    console.log('[FCM] No FCM tokens available. Skipping notification.');
    return;
  }

  // FCM Legacy HTTP API (still works and simpler)
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
    data: {
      ...data,
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    },
  };

  try {
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${serverKey}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log('[FCM] Push sent. Success:', result.success, '| Failure:', result.failure);
    if (result.results) {
      result.results.forEach((r, i) => {
        if (r.error) console.error(`[FCM] Token[${i}] error: ${r.error}`);
      });
    }
  } catch (err) {
    console.error('[FCM] sendFCMToTokens failed:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Get all FCM tokens from users_collection
// ─────────────────────────────────────────────────────────────────────────────
async function getAllFCMTokens(databases, DATABASE_ID, USERS_COLLECTION) {
  try {
    const techDocs = await databases.listDocuments(DATABASE_ID, USERS_COLLECTION);
    const tokens = techDocs.documents
      .flatMap(d => Array.isArray(d.fcmToken) ? d.fcmToken : [])
      .filter(t => typeof t === 'string' && t.length > 10);
    console.log(`[FCM] Found ${tokens.length} registered FCM tokens across ${techDocs.total} users.`);
    return tokens;
  } catch (err) {
    console.error('[FCM] Failed to fetch FCM tokens:', err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────
module.exports = async function (req, res) {
  const client = new sdk.Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID);

  const apiKey = process.env.APPWRITE_API_KEY;
  if (apiKey) {
    client.setKey(apiKey);
  } else {
    const jwt = req.headers['x-appwrite-user-jwt'];
    if (jwt) client.setJWT(jwt);
  }

  const { path = '/', method = 'GET', body: reqBody = {} } = req;

  let body = reqBody;
  try {
    if (typeof reqBody === 'string' && reqBody.trim().startsWith('{')) {
      body = JSON.parse(reqBody);
    }
  } catch (e) {
    return res.json({ error: 'Invalid JSON body' }, 400);
  }

  const databases = new sdk.Databases(client);

  // ── Collection IDs ─────────────────────────────────────────────────────────
  const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || '69cbdded00392d03962c';
  const MAINTENANCE_COL = 'maintenance';       // The REAL tasks collection
  const PRINTERS_COL = 'printers';
  const USERS_COL = 'users_collection';

  try {

    // ── GET /tasks ─────────────────────────────────────────────────────────
    if (path === '/tasks' && method === 'GET') {
      const list = await databases.listDocuments(DATABASE_ID, MAINTENANCE_COL, [
        sdk.Query.limit(100),
        sdk.Query.orderDesc('$createdAt'),
      ]);

      // Sort: by numeric priority ASC (1=urgent), then oldest createdAt first
      const sorted = list.documents.sort((a, b) => {
        const pA = calcPriority(a.error_type);
        const pB = calcPriority(b.error_type);
        if (pA !== pB) return pA - pB;
        return new Date(a.startTime || a.$createdAt).getTime() -
          new Date(b.startTime || b.$createdAt).getTime();
      });

      return res.json({ success: true, tasks: sorted });
    }

    // ── GET /printers ──────────────────────────────────────────────────────
    if (path === '/printers' && method === 'GET') {
      const list = await databases.listDocuments(DATABASE_ID, PRINTERS_COL, [
        sdk.Query.limit(100),
      ]);
      return res.json({ success: true, printers: list.documents });
    }

    // ── GET /users ─────────────────────────────────────────────────────────
    if (path === '/users' && method === 'GET') {
      const list = await databases.listDocuments(DATABASE_ID, USERS_COL, [
        sdk.Query.limit(100),
      ]);
      return res.json({ success: true, users: list.documents });
    }

    // ── POST /tasks — create a new maintenance task + FCM push ─────────────
    if (path === '/tasks' && method === 'POST') {
      const { printerId, issueType, location, building, floor } = body;

      const errorType = Array.isArray(issueType) ? issueType[0] : (issueType || 'Unknown');
      const priority = calcPriority(errorType);
      const now = new Date().toISOString();

      const newTask = await databases.createDocument(
        DATABASE_ID, MAINTENANCE_COL, sdk.ID.unique(),
        {
          printer_id: printerId || 'Unknown',
          error_type: errorType,
          location: location || 'Unknown',
          building: building || '-',
          floor: floor || '-',
          startTime: now,
          printerFixed: false,
          employee_one: null,
        }
      );

      console.log(`[Tasks] Created task ${newTask.$id} | priority=${priority} | issue=${errorType}`);

      // ── Send FCM if priority is HIGH (1, 2, or 3) ─────────────────────
      if (priority <= 3) {
        const tokens = await getAllFCMTokens(databases, DATABASE_ID, USERS_COL);
        const urgencyLabel = priority === 1 ? '🚨 CRITICAL' : priority === 2 ? '⚠️ URGENT' : '⚡ HIGH';
        await sendFCMToTokens(
          tokens,
          `${urgencyLabel}: ${errorType}`,
          `Printer ${printerId || 'Unknown'} at ${location || 'Unknown'} needs immediate attention!`,
          { taskId: newTask.$id, priority: String(priority), screen: 'tasks' }
        );
      }

      return res.json({ success: true, taskId: newTask.$id, priority });
    }

    // ── POST /notify — called by Appwrite DB event trigger ───────────────
    // Configure in Appwrite Console → Functions → Events:
    //   databases.*.collections.maintenance.documents.*.create
    if (path === '/notify' && (method === 'POST' || method === 'GET')) {
      // The event payload is in req.body when called from an Appwrite trigger
      const payload = body;
      const errorType = payload.error_type || payload.issueType || 'Unknown Issue';
      const location = payload.location || 'Unknown Location';
      const printerId = payload.printer_id || payload.printerId || 'Unknown';
      const priority = calcPriority(errorType);

      console.log(`[Notify] New task event: issue=${errorType} priority=${priority} printer=${printerId}`);

      if (priority <= 3) {
        const tokens = await getAllFCMTokens(databases, DATABASE_ID, USERS_COL);
        const urgencyLabel = priority === 1 ? '🚨 CRITICAL' : priority === 2 ? '⚠️ URGENT' : '⚡ HIGH';
        await sendFCMToTokens(
          tokens,
          `${urgencyLabel}: ${errorType}`,
          `Printer ${printerId} at ${location} needs immediate attention!`,
          { priority: String(priority), screen: 'tasks' }
        );
        return res.json({ success: true, pushed: tokens.length });
      }

      return res.json({ success: true, pushed: 0, reason: `Priority ${priority} is not high enough` });
    }

    // ── POST /notifyAll — broadcast test push to all devices ─────────────
    if (path === '/notifyAll' && method === 'POST') {
      const { title = 'SupportA4 Alert', message = 'New task available' } = body;
      const tokens = await getAllFCMTokens(databases, DATABASE_ID, USERS_COL);
      await sendFCMToTokens(tokens, title, message, { screen: 'tasks' });
      return res.json({ success: true, pushed: tokens.length });
    }

    // ── POST /saveToken — save FCM device token ───────────────────────────
    if (path === '/saveToken' && method === 'POST') {
      const { userId, fcmToken } = body;
      if (!userId || !fcmToken) {
        return res.json({ error: 'Missing userId or fcmToken' }, 400);
      }

      try {
        const userDoc = await databases.getDocument(DATABASE_ID, USERS_COL, userId);
        const currentTokens = Array.isArray(userDoc.fcmToken) ? userDoc.fcmToken : [];

        if (!currentTokens.includes(fcmToken)) {
          await databases.updateDocument(DATABASE_ID, USERS_COL, userId, {
            fcmToken: [...currentTokens, fcmToken],
          });
          console.log(`[SaveToken] Registered new FCM token for user ${userId}`);
        } else {
          console.log(`[SaveToken] Token already registered for user ${userId}`);
        }
      } catch (docErr) {
        // Document might not exist yet
        console.error('[SaveToken] Error:', docErr.message);
        return res.json({ error: 'User not found', detail: docErr.message }, 404);
      }

      return res.json({ success: true });
    }

    // ── PUT /complete/:taskId ─────────────────────────────────────────────
    if (path.startsWith('/complete/') && (method === 'PUT' || method === 'POST')) {
      const taskId = path.split('/complete/')[1];
      if (!taskId) return res.json({ error: 'Missing taskId' }, 400);

      const { employeeId, notes } = body;
      const now = new Date();

      // Mark task as fixed in maintenance collection
      await databases.updateDocument(DATABASE_ID, MAINTENANCE_COL, taskId, {
        printerFixed: true,
        employee_one: employeeId || null,
        notes: notes || '',
      });

      console.log(`[Complete] Task ${taskId} marked as fixed by ${employeeId}`);
      return res.json({ success: true, taskId });
    }

    // ── Default 404 ───────────────────────────────────────────────────────
    console.log(`[Router] No route matched: ${method} ${path}`);
    return res.json({ error: `Not Found: ${method} ${path}` }, 404);

  } catch (err) {
    console.error('[Backend] Unhandled error:', err.message, err.stack);
    return res.json({
      success: false,
      message: err.message,
      code: err.code || 500,
    }, err.code || 500);
  }
};
