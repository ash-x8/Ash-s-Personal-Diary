import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  getDocs,
  getDoc,
  getDocFromServer,
  type Unsubscribe,
} from 'firebase/firestore';
import type { DiaryChapter, DiaryEntry, DiarySettings, MediaItem, UserRole } from '../types';
import { sanitizeEntryForFirestore } from '../utils/imageCompressor';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
  };
}

const OWNER_ADMIN_EMAIL = 'kushanashvika216@gmail.com';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCE77gqSboOqivCz-U0MPgPBbXi3P1VLs8',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'ash-wickramasinghe.firebaseapp.com',
  databaseURL:
    import.meta.env.VITE_FIREBASE_DATABASE_URL ||
    'https://ash-wickramasinghe-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'ash-wickramasinghe',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'ash-wickramasinghe.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1055246300348',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1055246300348:web:b486d841daada8a4490cb9',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-83HT3XXSCC',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export let analytics: ReturnType<typeof getAnalytics> | null = null;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch {
    // Analytics may be disabled in privacy-restricted frames
  }
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const db = getFirestore(app);
export const firestore = db;

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  return errInfo;
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration or network connection.');
    }
    return false;
  }
}

export async function signInWithGoogle(): Promise<{
  user: FirebaseUser;
  role: UserRole;
}> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const role = await resolveFirebaseUserRole(result.user);
    return { user: result.user, role };
  } catch (err) {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/unauthorized-domain') {
      throw new Error(
        'This preview domain is not yet allowlisted in Firebase Auth -> Settings -> Authorized domains. Use your Diary PIN to sign in here, or add this domain in Firebase Console.'
      );
    }
    if (code === 'auth/popup-blocked') {
      throw new Error(
        'Sign-in popup was blocked by your browser. Allow popups or sign in with your Diary PIN.'
      );
    }
    if (code === 'auth/operation-not-allowed') {
      throw new Error(
        'Google Sign-In is disabled in this Firebase project. Enable Google in Firebase Authentication -> Sign-in method, or use your Diary PIN.'
      );
    }
    throw err;
  }
}

export async function signOutFirebase(): Promise<void> {
  await firebaseSignOut(auth);
}

export function subscribeToFirebaseAuth(
  callback: (user: FirebaseUser | null) => void
): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

export async function resolveFirebaseUserRole(user: FirebaseUser): Promise<UserRole> {
  if (
    user.email &&
    user.emailVerified &&
    user.email.toLowerCase() === OWNER_ADMIN_EMAIL.toLowerCase()
  ) {
    return 'EDITOR';
  }
  try {
    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    if (adminSnap.exists()) {
      return 'EDITOR';
    }
  } catch {
    // Non-admin reader
  }
  return 'READER';
}

function cleanFirestoreData<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        result[key] = cleanFirestoreData(val as Record<string, unknown>);
      } else {
        result[key] = val;
      }
    }
  }
  return result;
}

function extractIsoTimestamp(val: unknown, fallback: string): string {
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof val === 'string' && val) {
    return val;
  }
  return fallback;
}

export function docToChapter(id: string, data: Record<string, unknown>): DiaryChapter {
  const now = new Date().toISOString();
  const createdAtStr = extractIsoTimestamp(data.createdAt, now);
  const updatedAtStr = extractIsoTimestamp(data.updatedAt, createdAtStr);

  return {
    id,
    chapterTitle: String(data.chapterTitle || data.title || 'Untitled Chapter'),
    description: typeof data.description === 'string' ? data.description : '',
    rawContent:
      data.rawContent !== undefined
        ? String(data.rawContent)
        : typeof data.content === 'string'
        ? data.content
        : '',
    date: typeof data.date === 'string' ? data.date : createdAtStr.split('T')[0],
    mood: typeof data.mood === 'string' ? data.mood : undefined,
    location: typeof data.location === 'string' ? data.location : undefined,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    coverImage: typeof data.coverImage === 'string' ? data.coverImage : undefined,
    gallery: Array.isArray(data.gallery) ? data.gallery.map(String) : [],
    status: data.status === 'draft' ? 'draft' : 'published',
    order:
      typeof data.order === 'number'
        ? data.order
        : typeof data.pageOrder === 'number'
        ? data.pageOrder
        : 1,
    isSecret: Boolean(data.isSecret),
    securityKey:
      typeof data.securityKey === 'string'
        ? data.securityKey
        : typeof data.secretPasscode === 'string'
        ? data.secretPasscode
        : undefined,
    securityHint:
      typeof data.securityHint === 'string'
        ? data.securityHint
        : typeof data.secretHint === 'string'
        ? data.secretHint
        : undefined,
    secretPasscode:
      typeof data.securityKey === 'string'
        ? data.securityKey
        : typeof data.secretPasscode === 'string'
        ? data.secretPasscode
        : undefined,
    createdAt: createdAtStr,
    updatedAt: updatedAtStr,
  };
}

export function subscribeToDiaryChapters(
  onUpdate: (chapters: DiaryChapter[]) => void,
  onlyPublished: boolean = false,
  onError?: (err: Error) => void
): Unsubscribe {
  const chaptersColl = collection(db, 'diary_chapters');

  return onSnapshot(
    chaptersColl,
    (snapshot) => {
      const items: DiaryChapter[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!onlyPublished || data.status === 'published' || !data.status) {
          items.push(docToChapter(docSnap.id, data));
        }
      });

      items.sort((a, b) => {
        if ((a.order || 0) !== (b.order || 0)) {
          return (a.order || 0) - (b.order || 0);
        }
        return new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
      });

      onUpdate(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'diary_chapters');
      if (onError) onError(err);
    }
  );
}

export function subscribeToActiveChapter(
  activeChapterId: string,
  onUpdate: (chapter: DiaryChapter | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const chapterRef = doc(db, 'diary_chapters', activeChapterId);

  return onSnapshot(
    chapterRef,
    (docSnap) => {
      if (docSnap.exists()) {
        onUpdate(docToChapter(docSnap.id, docSnap.data()));
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, `diary_chapters/${activeChapterId}`);
      if (onError) onError(err);
    }
  );
}

export async function handleAddChapter(
  customFields?: Partial<DiaryChapter>
): Promise<DiaryChapter> {
  const newDocRef = doc(collection(db, 'diary_chapters'));
  const now = new Date().toISOString();

  let nextOrder = 1;
  try {
    const snap = await getDocs(collection(db, 'diary_chapters'));
    nextOrder = snap.size + 1;
  } catch {
    // Fallback order 1
  }

  const initialData: Record<string, unknown> = {
    chapterTitle: customFields?.chapterTitle || 'Untitled Chapter',
    description: customFields?.description || '',
    rawContent: customFields?.rawContent || '<p></p>',
    date: customFields?.date || now.split('T')[0],
    status: customFields?.status || 'draft',
    order: customFields?.order || nextOrder,
    tags: customFields?.tags || [],
    gallery: customFields?.gallery || [],
    coverImage: customFields?.coverImage || '',
    mood: customFields?.mood || 'Reflective',
    location: customFields?.location || '',
    isSecret: Boolean(customFields?.isSecret),
    securityKey: customFields?.securityKey || '',
    securityHint: customFields?.securityHint || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const sanitizedData = await sanitizeEntryForFirestore(initialData);
    await setDoc(newDocRef, cleanFirestoreData(sanitizedData));
    return docToChapter(newDocRef.id, { ...sanitizedData, createdAt: now, updatedAt: now });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `diary_chapters/${newDocRef.id}`);
    throw err;
  }
}

export async function saveChapterToFirestore(
  chapterData: Partial<DiaryChapter>,
  id?: string
): Promise<DiaryChapter> {
  const chapterId = id || `chapter-${Date.now()}`;
  const docRef = doc(db, 'diary_chapters', chapterId);
  const now = new Date().toISOString();

  const dataToSave: Record<string, unknown> = {
    ...chapterData,
    chapterTitle: chapterData.chapterTitle || 'Untitled Chapter',
    rawContent: chapterData.rawContent !== undefined ? chapterData.rawContent : '',
    updatedAt: serverTimestamp(),
  };

  if (!id) {
    dataToSave.createdAt = serverTimestamp();
  }

  try {
    const sanitizedData = await sanitizeEntryForFirestore(dataToSave);
    await setDoc(docRef, cleanFirestoreData(sanitizedData), { merge: true });
    return docToChapter(chapterId, {
      ...sanitizedData,
      createdAt: sanitizedData.createdAt || now,
      updatedAt: now,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `diary_chapters/${chapterId}`);
    throw err;
  }
}

export async function deleteChapterFromFirestore(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'diary_chapters', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `diary_chapters/${id}`);
    throw err;
  }
}

export async function reorderChaptersInFirestore(
  order: { id: string; order: number }[]
): Promise<void> {
  try {
    for (const item of order) {
      await updateDoc(doc(db, 'diary_chapters', item.id), {
        order: item.order,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'diary_chapters');
    throw err;
  }
}

function docToEntry(id: string, data: Record<string, unknown>): DiaryEntry {
  const now = new Date().toISOString();
  const createdAtStr = extractIsoTimestamp(data.createdAt, now);
  const updatedAtStr = extractIsoTimestamp(data.updatedAt, createdAtStr);

  return {
    id,
    title: String(data.title || 'Untitled Page'),
    slug: String(data.slug || id),
    content: String(data.content || ''),
    date: typeof data.date === 'string' ? data.date : createdAtStr.split('T')[0],
    mood: typeof data.mood === 'string' ? data.mood : undefined,
    location: typeof data.location === 'string' ? data.location : undefined,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    coverImage: typeof data.coverImage === 'string' ? data.coverImage : undefined,
    gallery: Array.isArray(data.gallery) ? data.gallery.map(String) : [],
    status: data.status === 'draft' ? 'draft' : 'published',
    pageOrder: typeof data.pageOrder === 'number' ? data.pageOrder : 1,
    customPageNumber: data.customPageNumber ? Number(data.customPageNumber) : undefined,
    isSecret: Boolean(data.isSecret),
    securityKey: typeof data.securityKey === 'string' ? data.securityKey : undefined,
    securityHint: typeof data.securityHint === 'string' ? data.securityHint : undefined,
    secretPasscode: typeof data.secretPasscode === 'string' ? data.secretPasscode : undefined,
    secretHint: typeof data.secretHint === 'string' ? data.secretHint : undefined,
    chapterId: typeof data.chapterId === 'string' ? data.chapterId : undefined,
    createdAt: createdAtStr,
    updatedAt: updatedAtStr,
    publishedAt: typeof data.publishedAt === 'string' ? data.publishedAt : undefined,
  };
}

export function subscribeToDiaryPages(
  onUpdate: (entries: DiaryEntry[]) => void,
  onlyPublished: boolean = false,
  onError?: (err: Error) => void
): Unsubscribe {
  const pagesColl = collection(db, 'diary_pages');

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

      items.sort((a, b) => {
        if (a.pageOrder !== b.pageOrder) {
          return (a.pageOrder || 0) - (b.pageOrder || 0);
        }
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      onUpdate(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'diary_pages');
      if (onError) onError(err);
    }
  );
}

export function subscribeToActivePage(
  activePageId: string,
  onUpdate: (entry: DiaryEntry | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const pageRef = doc(db, 'diary_pages', activePageId);

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
      handleFirestoreError(err, OperationType.GET, `diary_pages/${activePageId}`);
      if (onError) onError(err);
    }
  );
}

export async function handleAddPage(customFields?: Partial<DiaryEntry>): Promise<DiaryEntry> {
  const newDocRef = doc(collection(db, 'diary_pages'));
  const now = new Date().toISOString();

  let nextOrder = 1;
  try {
    const snap = await getDocs(collection(db, 'diary_pages'));
    nextOrder = snap.size + 1;
  } catch {
    // Fallback order 1
  }

  const initialData: Record<string, unknown> = {
    title: customFields?.title || 'Untitled Page',
    content: customFields?.content || '<p></p>',
    date: customFields?.date || now.split('T')[0],
    status: customFields?.status || 'draft',
    pageOrder: customFields?.pageOrder || nextOrder,
    customPageNumber: customFields?.customPageNumber || nextOrder,
    tags: customFields?.tags || [],
    gallery: customFields?.gallery || [],
    coverImage: customFields?.coverImage || '',
    mood: customFields?.mood || 'Reflective',
    location: customFields?.location || '',
    chapterId: customFields?.chapterId || '',
    isSecret: Boolean(customFields?.isSecret),
    secretPasscode: customFields?.secretPasscode || customFields?.securityKey || '',
    secretHint: customFields?.secretHint || customFields?.securityHint || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const sanitizedData = await sanitizeEntryForFirestore(initialData);
    await setDoc(newDocRef, cleanFirestoreData(sanitizedData));
    return docToEntry(newDocRef.id, { ...sanitizedData, createdAt: now, updatedAt: now });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `diary_pages/${newDocRef.id}`);
    throw err;
  }
}

export async function saveEntryToFirestore(
  entryData: Partial<DiaryEntry>,
  id?: string
): Promise<DiaryEntry> {
  const entryId = id || `entry-${Date.now()}`;
  const docRef = doc(db, 'diary_pages', entryId);
  const now = new Date().toISOString();

  const dataToSave: Record<string, unknown> = {
    ...entryData,
    id: entryId,
    updatedAt: serverTimestamp(),
  };

  if (!id) {
    dataToSave.createdAt = serverTimestamp();
  }
  if (entryData.status === 'published' && !entryData.publishedAt) {
    dataToSave.publishedAt = now;
  }

  try {
    const sanitizedData = await sanitizeEntryForFirestore(dataToSave);
    await setDoc(docRef, cleanFirestoreData(sanitizedData), { merge: true });
    return docToEntry(entryId, {
      ...sanitizedData,
      createdAt: sanitizedData.createdAt || now,
      updatedAt: now,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `diary_pages/${entryId}`);
    throw err;
  }
}

export async function deleteEntryFromFirestore(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'diary_pages', id));
    await deleteDoc(doc(db, 'entries', id)).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `diary_pages/${id}`);
    throw err;
  }
}

export async function reorderEntriesInFirestore(
  order: { id: string; pageOrder: number }[]
): Promise<void> {
  try {
    for (const item of order) {
      await updateDoc(doc(db, 'diary_pages', item.id), {
        pageOrder: item.pageOrder,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'diary_pages');
    throw err;
  }
}

export function subscribeToPublishedEntries(
  onUpdate: (entries: DiaryEntry[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return subscribeToDiaryPages(onUpdate, true, onError);
}

export function subscribeToAllEntries(
  onUpdate: (entries: DiaryEntry[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return subscribeToDiaryPages(onUpdate, false, onError);
}

export function subscribeToSettings(
  onUpdate: (settings: DiarySettings) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const settingsDocRef = doc(db, 'settings', 'general');

  return onSnapshot(
    settingsDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as DiarySettings);
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, 'settings/general');
      if (onError) onError(err);
    }
  );
}

export async function saveSettingsToFirestore(updates: Partial<DiarySettings>): Promise<void> {
  try {
    await setDoc(
      doc(db, 'settings', 'general'),
      cleanFirestoreData({
        ...updates,
        updatedAt: serverTimestamp(),
      }),
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/general');
    throw err;
  }
}

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
      handleFirestoreError(err, OperationType.LIST, 'media');
      if (onError) onError(err);
    }
  );
}

export async function addFirestoreMedia(item: MediaItem): Promise<void> {
  try {
    const sanitizedItem = await sanitizeEntryForFirestore({ ...item } as Record<string, unknown>);
    await setDoc(doc(db, 'media', item.id), cleanFirestoreData(sanitizedItem), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `media/${item.id}`);
    throw err;
  }
}

export async function deleteFirestoreMedia(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'media', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `media/${id}`);
    throw err;
  }
}
