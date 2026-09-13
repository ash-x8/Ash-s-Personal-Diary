import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  getDocs,
  getDoc,
  Unsubscribe 
} from "firebase/firestore";
import { DiaryEntry, DiarySettings, MediaItem } from '../types';
import { sanitizeEntryForFirestore } from '../utils/imageCompressor';

import firebaseAppletConfig from '../../firebase-applet-config.json';

const firebaseConfig = {
  projectId: firebaseAppletConfig.projectId || "endless-quote-51ttq",
  appId: firebaseAppletConfig.appId || "1:416026597596:web:322ba35009ebfc0a177c19",
  apiKey: firebaseAppletConfig.apiKey || "AIzaSyAekzhVaPluAKCLRZlrojsPyQEM2lXRp7Q",
  authDomain: firebaseAppletConfig.authDomain || "endless-quote-51ttq.firebaseapp.com",
  firestoreDatabaseId: firebaseAppletConfig.firestoreDatabaseId || "ai-studio-ashspersonaldiar-7ba74978-4588-4e7f-a379-646dfc05ae20",
  storageBucket: firebaseAppletConfig.storageBucket || "endless-quote-51ttq.firebasestorage.app",
  messagingSenderId: firebaseAppletConfig.messagingSenderId || "416026597596",
  measurementId: firebaseAppletConfig.measurementId || ""
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
let analytics: ReturnType<typeof getAnalytics> | null = null;
if (typeof window !== "undefined") {
  try {
    analytics = getAnalytics(app);
  } catch {
    // Analytics optional in sandbox
  }
}

export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);
export const firestore = db; // Backwards-compatible alias

/**
 * Utility: Strips undefined keys to satisfy Firestore constraints
 */
function cleanFirestoreData<T extends Record<string, any>>(data: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        result[key] = cleanFirestoreData(val);
      } else {
        result[key] = val;
      }
    }
  }
  return result;
}

/**
 * Convert Firestore document data to strongly-typed DiaryEntry
 */
function docToEntry(id: string, data: Record<string, any>): DiaryEntry {
  const createdAtStr = data.createdAt?.toDate 
    ? data.createdAt.toDate().toISOString() 
    : (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString());

  const updatedAtStr = data.updatedAt?.toDate 
    ? data.updatedAt.toDate().toISOString() 
    : (typeof data.updatedAt === 'string' ? data.updatedAt : createdAtStr);

  return {
    id,
    title: data.title || 'Untitled Page',
    slug: data.slug || id,
    content: data.content || '',
    date: data.date || createdAtStr.split('T')[0],
    mood: data.mood,
    location: data.location,
    tags: Array.isArray(data.tags) ? data.tags : [],
    coverImage: data.coverImage,
    gallery: Array.isArray(data.gallery) ? data.gallery : [],
    status: data.status === 'draft' ? 'draft' : 'published',
    pageOrder: typeof data.pageOrder === 'number' ? data.pageOrder : 1,
    customPageNumber: data.customPageNumber ? Number(data.customPageNumber) : undefined,
    isSecret: Boolean(data.isSecret),
    secretPasscode: data.secretPasscode || undefined,
    secretHint: data.secretHint || undefined,
    createdAt: createdAtStr,
    updatedAt: updatedAtStr,
    publishedAt: data.publishedAt
  };
}

/**
 * Real-time listener for diary_pages collection
 * Used across devices for Readers and Editors
 */
export function subscribeToDiaryPages(
  onUpdate: (entries: DiaryEntry[]) => void,
  onlyPublished: boolean = false,
  onError?: (err: Error) => void
): Unsubscribe {
  const pagesColl = collection(db, "diary_pages");

  return onSnapshot(
    pagesColl,
    (snapshot) => {
      const items: DiaryEntry[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!onlyPublished || data.status === 'published' || !data.status) {
          items.push(docToEntry(docSnap.id, data));
        }
      });

      // Sort by pageOrder ascending, then date descending
      items.sort((a, b) => {
        if (a.pageOrder !== b.pageOrder) {
          return (a.pageOrder || 0) - (b.pageOrder || 0);
        }
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      onUpdate(items);
    },
    (err) => {
      console.warn("Firestore diary_pages snapshot error:", err);
      if (onError) onError(err);
    }
  );
}

/**
 * Real-time listener for a single active page (Multi-device active sync)
 */
export function subscribeToActivePage(
  activePageId: string,
  onUpdate: (entry: DiaryEntry | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const pageRef = doc(db, "diary_pages", activePageId);

  return onSnapshot(
    pageRef,
    (docSnap) => {
      if (docSnap.exists()) {
        onUpdate(docToEntry(docSnap.id, docSnap.data()));
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      console.warn(`Firestore active page [${activePageId}] error:`, err);
      if (onError) onError(err);
    }
  );
}

/**
 * Add a new page immediately to Firestore collection "diary_pages"
 * Solves the dynamic page creation & refresh persistence problem
 */
export async function handleAddPage(customFields?: Partial<DiaryEntry>): Promise<DiaryEntry> {
  const newDocRef = doc(collection(db, "diary_pages"));
  const now = new Date().toISOString();

  // Find next page order
  let nextOrder = 1;
  try {
    const snap = await getDocs(collection(db, "diary_pages"));
    nextOrder = snap.size + 1;
  } catch {}

  const initialData: Record<string, any> = {
    title: customFields?.title || "Untitled Page",
    content: customFields?.content || "<p></p>",
    date: customFields?.date || now.split('T')[0],
    status: customFields?.status || "published",
    pageOrder: customFields?.pageOrder || nextOrder,
    customPageNumber: customFields?.customPageNumber || nextOrder,
    tags: customFields?.tags || [],
    gallery: customFields?.gallery || [],
    coverImage: customFields?.coverImage || "",
    mood: customFields?.mood || "Reflective",
    location: customFields?.location || "",
    isSecret: Boolean(customFields?.isSecret),
    secretPasscode: customFields?.secretPasscode || "",
    secretHint: customFields?.secretHint || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const sanitizedData = await sanitizeEntryForFirestore(initialData);
  await setDoc(newDocRef, cleanFirestoreData(sanitizedData));

  return {
    id: newDocRef.id,
    title: sanitizedData.title,
    slug: newDocRef.id,
    content: sanitizedData.content,
    date: sanitizedData.date,
    mood: sanitizedData.mood,
    location: sanitizedData.location,
    tags: sanitizedData.tags,
    coverImage: sanitizedData.coverImage,
    gallery: sanitizedData.gallery,
    status: sanitizedData.status,
    pageOrder: sanitizedData.pageOrder,
    customPageNumber: sanitizedData.customPageNumber,
    isSecret: sanitizedData.isSecret,
    secretPasscode: sanitizedData.secretPasscode,
    secretHint: sanitizedData.secretHint,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Direct write / update of entry to Firestore "diary_pages"
 */
export async function saveEntryToFirestore(entryData: Partial<DiaryEntry>, id?: string): Promise<DiaryEntry> {
  const entryId = id || `entry-${Date.now()}`;
  const docRef = doc(db, "diary_pages", entryId);
  const now = new Date().toISOString();

  const dataToSave: Record<string, any> = {
    ...entryData,
    id: entryId,
    updatedAt: serverTimestamp()
  };

  if (!id) {
    dataToSave.createdAt = serverTimestamp();
  }
  if (entryData.status === 'published' && !entryData.publishedAt) {
    dataToSave.publishedAt = now;
  }

  const sanitizedData = await sanitizeEntryForFirestore(dataToSave);
  await setDoc(docRef, cleanFirestoreData(sanitizedData), { merge: true });

  return {
    id: entryId,
    title: sanitizedData.title || 'Untitled Page',
    slug: sanitizedData.slug || entryId,
    content: sanitizedData.content || '',
    date: dataToSave.date || now.split('T')[0],
    mood: dataToSave.mood,
    location: dataToSave.location,
    tags: Array.isArray(dataToSave.tags) ? dataToSave.tags : [],
    coverImage: dataToSave.coverImage,
    gallery: Array.isArray(dataToSave.gallery) ? dataToSave.gallery : [],
    status: dataToSave.status === 'draft' ? 'draft' : 'published',
    pageOrder: Number(dataToSave.pageOrder) || 1,
    customPageNumber: dataToSave.customPageNumber ? Number(dataToSave.customPageNumber) : undefined,
    isSecret: Boolean(dataToSave.isSecret),
    secretPasscode: dataToSave.secretPasscode,
    secretHint: dataToSave.secretHint,
    createdAt: dataToSave.createdAt || now,
    updatedAt: now,
    publishedAt: dataToSave.publishedAt
  };
}

/**
 * Direct delete from Firestore "diary_pages"
 */
export async function deleteEntryFromFirestore(id: string): Promise<void> {
  try {
    const docRef = doc(db, "diary_pages", id);
    await deleteDoc(docRef);
    await deleteDoc(doc(db, "entries", id)).catch(() => {});
  } catch (err) {
    console.error("Error deleting entry from Firestore:", err);
    throw err;
  }
}

/**
 * Reorder entries in Firestore "diary_pages"
 */
export async function reorderEntriesInFirestore(order: { id: string; pageOrder: number }[]): Promise<void> {
  for (const item of order) {
    const docRef = doc(db, "diary_pages", item.id);
    await updateDoc(docRef, {
      pageOrder: item.pageOrder,
      updatedAt: serverTimestamp()
    });
  }
}

/**
 * Real-time listener for Published Entries (for BookReader)
 */
export function subscribeToPublishedEntries(
  onUpdate: (entries: DiaryEntry[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return subscribeToDiaryPages(onUpdate, true, onError);
}

/**
 * Real-time listener for All Entries (for EditorDashboard)
 */
export function subscribeToAllEntries(
  onUpdate: (entries: DiaryEntry[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return subscribeToDiaryPages(onUpdate, false, onError);
}

/**
 * Direct fetch of published entries
 */
export async function fetchPublishedEntriesFromFirestore(): Promise<DiaryEntry[]> {
  try {
    const snap = await getDocs(collection(db, "diary_pages"));
    const items: DiaryEntry[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.status === 'published' || !data.status) {
        items.push(docToEntry(d.id, data));
      }
    });
    return items.sort((a, b) => (a.pageOrder || 0) - (b.pageOrder || 0));
  } catch (err) {
    console.warn("Fetch published entries error:", err);
    return [];
  }
}

/**
 * Direct fetch of all entries
 */
export async function fetchAllEntriesFromFirestore(): Promise<DiaryEntry[]> {
  try {
    const snap = await getDocs(collection(db, "diary_pages"));
    const items: DiaryEntry[] = [];
    snap.forEach((d) => {
      items.push(docToEntry(d.id, d.data()));
    });
    return items.sort((a, b) => (a.pageOrder || 0) - (b.pageOrder || 0));
  } catch (err) {
    console.warn("Fetch all entries error:", err);
    return [];
  }
}

/**
 * Real-time listener for Diary Settings
 */
export function subscribeToSettings(
  onUpdate: (settings: DiarySettings) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const settingsDocRef = doc(db, 'settings', 'general');

  return onSnapshot(
    settingsDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as DiarySettings;
        onUpdate(data);
      }
    },
    (err) => {
      console.warn('Settings live listener error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Save settings to Firestore
 */
export async function saveSettingsToFirestore(updates: Partial<DiarySettings>): Promise<void> {
  const docRef = doc(db, 'settings', 'general');
  await setDoc(docRef, cleanFirestoreData({
    ...updates,
    updatedAt: serverTimestamp()
  }), { merge: true });
}

/**
 * Real-time listener for Media
 */
export function subscribeToMedia(
  onUpdate: (media: MediaItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const mediaColl = collection(db, 'media');

  return onSnapshot(
    mediaColl,
    (snapshot) => {
      const items: MediaItem[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as MediaItem);
      });
      items.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      onUpdate(items);
    },
    (err) => {
      console.warn('Media live listener error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Fetch settings from Firestore
 */
export async function fetchSettingsFromFirestore(): Promise<DiarySettings | null> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'general'));
    if (snap.exists()) {
      return snap.data() as DiarySettings;
    }
    return null;
  } catch (err) {
    console.warn('Fetch settings error:', err);
    return null;
  }
}

/**
 * Fetch media from Firestore
 */
export async function fetchMediaFromFirestore(): Promise<MediaItem[]> {
  try {
    const snap = await getDocs(collection(db, 'media'));
    const items: MediaItem[] = [];
    snap.forEach((d) => items.push(d.data() as MediaItem));
    return items.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  } catch (err) {
    console.warn('Fetch media error:', err);
    return [];
  }
}

/**
 * Save media item to Firestore
 */
export async function addFirestoreMedia(item: MediaItem): Promise<void> {
  const docRef = doc(db, 'media', item.id);
  const sanitizedItem = await sanitizeEntryForFirestore(item);
  await setDoc(docRef, cleanFirestoreData(sanitizedItem), { merge: true });
}

/**
 * Delete media item from Firestore
 */
export async function deleteFirestoreMedia(id: string): Promise<void> {
  const docRef = doc(db, 'media', id);
  await deleteDoc(docRef);
}

/**
 * Aliases for direct Firestore Entry CRUD
 */
export async function createFirestoreEntry(data: Partial<DiaryEntry>): Promise<DiaryEntry> {
  return handleAddPage(data);
}

export async function updateFirestoreEntry(id: string, data: Partial<DiaryEntry>): Promise<DiaryEntry> {
  return saveEntryToFirestore(data, id);
}

export async function deleteFirestoreEntry(id: string): Promise<void> {
  return deleteEntryFromFirestore(id);
}

export async function reorderFirestoreEntries(order: { id: string; pageOrder: number }[]): Promise<void> {
  return reorderEntriesInFirestore(order);
}

export async function updateFirestoreSettings(updates: Partial<DiarySettings>): Promise<DiarySettings> {
  await saveSettingsToFirestore(updates);
  const snap = await getDoc(doc(db, 'settings', 'general'));
  if (snap.exists()) {
    return snap.data() as DiarySettings;
  }
  return { ...updates } as DiarySettings;
}

