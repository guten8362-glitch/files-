import { Client, Databases, Users, Messaging, ID, Query } from 'node-appwrite';

/**
 * SupportA4 Backend Function
 * Handles: 
 * - GET /tasks: Fetch all maintenance tasks
 * - POST /saveToken: Register FCM device token as a target
 * - PUT /complete/:id: Mark a maintenance task as fixed
 * - Event: Trigger push notifications on database updates
 */
export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY || (req.headers['x-appwrite-key'] ?? ''));

  const databases = new Databases(client);
  const users = new Users(client);
  const messaging = new Messaging(client);

  const DATABASE_ID = '69cbdded00392d03962c';
  const COLLECTION_MAINTENANCE = 'maintenance';
  const COLLECTION_USERS = 'users';
  const COLLECTION_PRINTERS = 'printers';
  const COLLECTION_SHOPS = 'shops';
  
  const FCM_PROVIDER_ID = process.env.FCM_PROVIDER_ID || 'fcm_provider'; 

  // --- 1. Handle Database Events (Push Notifications) ---
  const event = req.headers['x-appwrite-event'];
  if (event) {
    log(`Handling event: ${event}`);
    try {
      const payload = req.body;
      const errorType = payload.error_type || 'Issue';
      const printerId = payload.printer_id || 'Unknown Printer';
      const employeeId = payload.employee_one || ''; 

      const messageContent = `${errorType} detected on ${printerId}`;
      
      if (employeeId) {
        log(`Sending direct push to ${employeeId}`);
        await messaging.createPush(
          ID.unique(),
          'SupportA4 Alert',
          messageContent,
          [employeeId]
        );
      } else {
        log('Broadcasting to all technicians');
        const techs = await databases.listDocuments(DATABASE_ID, COLLECTION_USERS);
        const userIds = techs.documents.map(d => d.$id);
        if (userIds.length > 0) {
          await messaging.createPush(ID.unique(), 'SupportA4 Alert', messageContent, userIds);
        }
      }
      return res.json({ status: 'notified' });
    } catch (err) {
      error(`Notification error: ${err.message}`);
    }
  }

  // --- 2. Handle HTTP Routes ---
  const path = req.path;
  const method = req.method;

  try {
    if (path === '/tasks' && method === 'GET') {
      const tasks = await databases.listDocuments(DATABASE_ID, COLLECTION_MAINTENANCE, [
        Query.orderAsc('startTime'),
        Query.limit(100)
      ]);
      return res.json({ tasks: tasks.documents });
    }

    if (path === '/users' && method === 'GET') {
      const docs = await databases.listDocuments(DATABASE_ID, COLLECTION_USERS);
      return res.json({ users: docs.documents });
    }


    if (path === '/printers' && method === 'GET') {
      const docs = await databases.listDocuments(DATABASE_ID, COLLECTION_PRINTERS);
      return res.json({ printers: docs.documents });
    }

    if (path === '/saveToken' && method === 'POST') {
      const { userId, fcmToken } = req.body;
      if (!userId || !fcmToken) return res.json({ error: 'Missing params' }, 400);

      await users.createTarget(userId, ID.unique(), FCM_PROVIDER_ID, fcmToken, {
        providerType: 'push'
      });
      
      log(`Registered token for user ${userId}`);
      return res.json({ status: 'registered' });
    }

    if (path.startsWith('/complete/') && method === 'PUT') {
      const taskId = path.split('/').pop();
      const { notes } = req.body;
      
      await databases.updateDocument(DATABASE_ID, COLLECTION_MAINTENANCE, taskId, {
        printerFixed: true,
        notes: notes || 'Fixed by technician'
      });
      
      return res.json({ status: 'completed' });
    }

    return res.json({
      name: "SupportA4 Backend",
      version: "1.2.1",
      status: "online"
    });

  } catch (err) {
    error(`API Error: ${err.message}`);
    return res.json({ error: err.message }, 500);
  }
};
