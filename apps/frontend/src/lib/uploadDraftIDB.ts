const DB_NAME = "wavee-upload";
const STORE = "draft";
const KEY = "current";

export interface UploadDraftRecord {
  title: string;
  genre: string;
  audioName: string;
  audioType: string;
  audioBlob: Blob;
  coverName?: string;
  coverType?: string;
  coverBlob?: Blob;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
}

export async function saveUploadDraft(record: UploadDraftRecord): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE).put(record, KEY);
    });
    db.close();
  } catch {
    /* private mode / quota */
  }
}

export async function loadUploadDraft(): Promise<UploadDraftRecord | null> {
  try {
    const db = await openDb();
    const record = await new Promise<UploadDraftRecord | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result as UploadDraftRecord | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return record ?? null;
  } catch {
    return null;
  }
}

export async function clearUploadDraft(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE).delete(KEY);
    });
    db.close();
  } catch {
    /* ignore */
  }
}
