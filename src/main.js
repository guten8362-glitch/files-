import { Client, Databases, Users, Messaging, ID, Query } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new Databases(client);
  const messaging = new Messaging(client);
  const users = new Users(client);

  const DATABASE_ID = '69cbdded00392d03962c';
  const TASKS_COL = 'maintenance';
  const USERS_COL = 'users';
  const PRINTERS_COL = 'printers';
  const HISTORY_COL = 'history';
  const FCM_PROVIDER_ID = '69d4d2ce0027660c1fe2';

  const path = req.path || '/';
  const method = req.method;

  log(`API CALL: ${method} ${path}`);

  try {
    // --- LOGIN / USER SEARCH ---
    if (path === '/users' && method === 'GET') {
      const result = await databases.listDocuments(DATABASE_ID, USERS_COL);
      return res.json({ success: true, users: result.documents });
    }

    // --- TASKS LIST ---
    if (path === '/tasks' && method === 'GET') {
      const result = await databases.listDocuments(DATABASE_ID, TASKS_COL, [
        Query.limit(100),
        Query.orderDesc('$createdAt')
      ]);
      return res.json({ success: true, tasks: result.documents });
    }

    // --- CREATE TASK ---
    if (path === '/tasks' && method === 'POST') {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const doc = await databases.createDocument(DATABASE_ID, TASKS_COL, ID.unique(), {
        ...payload,
        printerFixed: false,
        startTime: new Date().toISOString()
      });
      return res.json({ success: true, data: doc });
    }

    // --- SAVE TOKEN ---
    if (path === '/saveToken' && method === 'POST') {
      const { userId, fcmToken } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      try {
        await users.createTarget(userId, ID.unique(), 'push', fcmToken, undefined, FCM_PROVIDER_ID);
        await databases.updateDocument(DATABASE_ID, USERS_COL, userId, { fcmToken });
      } catch (e) {
        log('Token error: ' + e.message);
      }
      return res.json({ success: true });
    }

    // --- COMPLETE TASK ---
    if (path.startsWith('/complete/') && method === 'PUT') {
      const taskId = path.replace('/complete/', '');
      const { employeeId, notes } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      await databases.updateDocument(DATABASE_ID, TASKS_COL, taskId, {
        printerFixed: true,
        endTime: new Date().toISOString(),
        notes: notes || ""
      });
      return res.json({ success: true, message: 'Updated successfully' });
    }

    return res.json({ success: false, error: 'Route not found' }, 404);
  } catch (e) {
    error(e.message);
    return res.json({ success: false, error: e.message }, 500);
  }
};
