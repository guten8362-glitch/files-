// Appwrite REST API client — no SDK needed, uses native fetch()
export const APPWRITE = {
  endpoint:     'https://nyc.cloud.appwrite.io/v1',
  projectId:    '69cbdcee0026c57793ab',
  databaseId:   '69cbdded00392d03962c',
};

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
  const h = headers() as any;
  if (sessionSecret) h["X-Appwrite-Session"] = sessionSecret;
  
  const res  = await fetch(url, { headers: h });
  if (!res.ok) {
    const err = await res.text();
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
