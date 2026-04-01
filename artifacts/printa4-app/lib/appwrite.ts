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

/** List all documents in a collection (max 100 per call) */
export async function listDocuments(collectionId: string): Promise<any[]> {
  const url = `${APPWRITE.endpoint}/databases/${APPWRITE.databaseId}/collections/${collectionId}/documents?limit=100`;
  const res  = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Appwrite [${collectionId}]: ${res.status} ${err}`);
  }
  const json = await res.json();
  return json.documents ?? [];
}

/** Update a single document */
export async function updateDocument(collectionId: string, documentId: string, data: object): Promise<void> {
  const url = `${APPWRITE.endpoint}/databases/${APPWRITE.databaseId}/collections/${collectionId}/documents/${documentId}`;
  const res  = await fetch(url, {
    method:  'PATCH',
    headers: headers(),
    body:    JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Appwrite update [${collectionId}/${documentId}]: ${res.status} ${err}`);
  }
}
