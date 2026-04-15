import { Client, Databases } from "appwrite";

// Appwrite REST API client — no SDK needed, uses native fetch()
export const APPWRITE = {
  endpoint:     'https://nyc.cloud.appwrite.io/v1',
  projectId:    '69cbdcee0026c57793ab',
  databaseId:   '69cbdded00392d03962c',
};

const client = new Client();
client
  .setEndpoint(APPWRITE.endpoint)
  .setProject(APPWRITE.projectId);

export const databases = new Databases(client);
export { client };

const headers = () => ({
  'Content-Type':       'application/json',
  'X-Appwrite-Project': APPWRITE.projectId,
});

/** Create a new session (login) */
export async function createSession(email: string, password: string): Promise<any> {
  const url = `${APPWRITE.endpoint}/account/sessions/email`;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Login failed");
  }
  return await res.json();
}

/** Get the currently logged-in account */
export async function getAccount(sessionSecret: string): Promise<any> {
  const url = `${APPWRITE.endpoint}/account`;
  const res = await fetch(url, {
    headers: {
      ...headers(),
      "X-Appwrite-Session": sessionSecret,
    },
  });
  if (!res.ok) return null;
  return await res.json();
}

/** Delete the current session (logout) */
export async function deleteSession(sessionSecret: string): Promise<void> {
  const url = `${APPWRITE.endpoint}/account/sessions/current`;
  await fetch(url, {
    method: "DELETE",
    headers: {
      ...headers(),
      "X-Appwrite-Session": sessionSecret,
    },
  });
}

/** List all documents in a collection (max 100 per call) */
export async function listDocuments(collectionId: string, sessionSecret?: string): Promise<any[]> {
  const url = `${APPWRITE.endpoint}/databases/${APPWRITE.databaseId}/collections/${collectionId}/documents?limit=100`;
  console.log(`[Appwrite] Fetching from: ${collectionId} (Full URL: ${url})`);
  
  const h = headers() as any;
  if (sessionSecret) h["X-Appwrite-Session"] = sessionSecret;
  
  const res  = await fetch(url, { headers: h });
  if (!res.ok) {
    const err = await res.text();
    console.error(`[Appwrite Error] Status: ${res.status} | Collection: ${collectionId} | Response:`, err);
    throw new Error(`Appwrite [${collectionId}]: ${res.status} ${err}`);
  }
  const json = await res.json();
  return json.documents ?? [];
}

/** Update a single document */
export async function updateDocument(collectionId: string, documentId: string, data: object, sessionSecret?: string): Promise<void> {
  const url = `${APPWRITE.endpoint}/databases/${APPWRITE.databaseId}/collections/${collectionId}/documents/${documentId}`;
  const h = headers() as any;
  if (sessionSecret) h["X-Appwrite-Session"] = sessionSecret;

  const res  = await fetch(url, {
    method:  'PATCH',
    headers: h,
    body:    JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Appwrite update [${collectionId}/${documentId}]: ${res.status} ${err}`);
  }
}

/** Execute a Cloud Function */
export async function executeFunction(path: string, method: string = 'POST', data?: object, sessionSecret?: string): Promise<any> {
  const url = `${APPWRITE.endpoint}/functions/69d7268500220e52ca26/executions`;
  const h = headers() as any;
  if (sessionSecret) h["X-Appwrite-Session"] = sessionSecret;

  const res = await fetch(url, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({
      async: false,
      path: path, // Correct field for Appwrite Function routing

      method: method,
      body: data ? JSON.stringify(data) : undefined
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Appwrite function execution failed: ${res.status} ${err}`);
  }

  const json = await res.json();
  if (json.status === 'failed') {
    throw new Error(`Function execution status failed: ${json.errors || 'Unknown error'}`);
  }

  try {
    return JSON.parse(json.responseBody);
  } catch (e) {
    return json.responseBody;
  }
}
