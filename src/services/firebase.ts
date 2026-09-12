import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { DiaryEntry, DiarySettings, MediaItem } from '../types';
import { DEFAULT_ENTRIES, DEFAULT_SETTINGS } from './localDb';

const firebaseConfig = {
  apiKey: "AIzaSyAxjKbrk-LNo8_3yaB7Sr1SF927X437dPc",
  authDomain: "ash-s-diary.firebaseapp.com",
  projectId: "ash-s-diary",
  storageBucket: "ash-s-diary.firebasestorage.app",
  messagingSenderId: "1073440074463",
  appId: "1:1073440074463:web:107d5948041ed269a1d76a",
  measurementId: "G-FM1G5M1VLM"
};

export const app = initializeApp(firebaseConfig);
export const firestore = getFirestore(app);

// Collection References
const ENTRIES_COLLECTION = 'diary_pages';
const SETTINGS_COLLECTION = 'settings';
const MEDIA_COLLECTION = 'media';
const SETTINGS_DOC_ID = 'app_settings';

// Seeding helper to initialize Firestore with initial data if empty
let isSeeded = false;
export async function seedFirestoreIfEmpty() {
  if (isSeeded) return;
  try {
    const entriesSnap = await getDocs(collection(firestore, ENTRIES_COLLECTION));
    if (entriesSnap.empty) {
      for (const entry of DEFAULT_ENTRIES) {
        await setDoc(doc(firestore, ENTRIES_COLLECTION, entry.id), entry);
      }
    }

    const settingsDocSnap = await getDoc(doc(firestore, SETTINGS_COLLECTION, SETTINGS_DOC_ID));
    if (!settingsDocSnap.exists()) {
      await setDoc(doc(firestore, SETTINGS_COLLECTION, SETTINGS_DOC_ID), DEFAULT_SETTINGS);
    }
    isSeeded = true;
  } catch (err) {
    console.error('Error seeding Firestore:', err);
  }
}

// Real-time Listeners
export function subscribeToEntries(callback: (entries: DiaryEntry[]) => void): Unsubscribe {
  seedFirestoreIfEmpty();
  const entriesRef = collection(firestore, ENTRIES_COLLECTION);
  return onSnapshot(
    entriesRef,
    (snapshot) => {
      const entries: DiaryEntry[] = [];
      snapshot.forEach((docSnap) => {
        entries.push(docSnap.data() as DiaryEntry);
      });
      entries.sort((a, b) => (a.pageOrder ?? 0) - (b.pageOrder ?? 0));
      callback(entries);
    },
    (error) => {
      console.error('Error listening to entries snapshot:', error);
    }
  );
}

export function subscribeToSettings(callback: (settings: DiarySettings) => void): Unsubscribe {
  seedFirestoreIfEmpty();
  const settingsDocRef = doc(firestore, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
  return onSnapshot(
    settingsDocRef,
    (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as DiarySettings);
      }
    },
    (error) => {
      console.error('Error listening to settings snapshot:', error);
    }
  );
}

export function subscribeToMedia(callback: (media: MediaItem[]) => void): Unsubscribe {
  seedFirestoreIfEmpty();
  const mediaRef = collection(firestore, MEDIA_COLLECTION);
  return onSnapshot(
    mediaRef,
    (snapshot) => {
      const mediaItems: MediaItem[] = [];
      snapshot.forEach((docSnap) => {
        mediaItems.push(docSnap.data() as MediaItem);
      });
      mediaItems.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      callback(mediaItems);
    },
    (error) => {
      console.error('Error listening to media snapshot:', error);
    }
  );
}

// Data Mutation Operations (Add, Edit, Delete)
export async function createFirestoreEntry(entryData: Partial<DiaryEntry>): Promise<DiaryEntry> {
  const id = `entry-${Date.now()}`;
  const now = new Date().toISOString();

  // Calculate default page order
  const entriesSnap = await getDocs(collection(firestore, ENTRIES_COLLECTION));
  const count = entriesSnap.size;
  const title = entryData.title || 'Untitled Entry';
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const newEntry: DiaryEntry = {
    id,
    title,
    slug,
    content: entryData.content || '',
    date: entryData.date || now.split('T')[0],
    createdAt: now,
    updatedAt: now,
    publishedAt: entryData.status === 'published' ? now : undefined,
    status: entryData.status || 'draft',
    pageOrder: entryData.pageOrder !== undefined ? entryData.pageOrder : count + 1,
    customPageNumber: entryData.customPageNumber !== undefined ? entryData.customPageNumber : count + 1,
    mood: entryData.mood,
    location: entryData.location,
    tags: entryData.tags || [],
    coverImage: entryData.coverImage,
    gallery: entryData.gallery || []
  };

  await setDoc(doc(firestore, ENTRIES_COLLECTION, id), newEntry);
  return newEntry;
}

export async function updateFirestoreEntry(id: string, updates: Partial<DiaryEntry>): Promise<DiaryEntry> {
  const docRef = doc(firestore, ENTRIES_COLLECTION, id);
  const existingSnap = await getDoc(docRef);

  if (!existingSnap.exists()) {
    throw new Error('Entry not found');
  }

  const existingData = existingSnap.data() as DiaryEntry;
  const updatedEntry: DiaryEntry = {
    ...existingData,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  await setDoc(docRef, updatedEntry, { merge: true });
  return updatedEntry;
}

export async function deleteFirestoreEntry(id: string): Promise<boolean> {
  await deleteDoc(doc(firestore, ENTRIES_COLLECTION, id));
  return true;
}

export async function reorderFirestoreEntries(order: { id: string; pageOrder: number }[]): Promise<boolean> {
  for (const item of order) {
    const docRef = doc(firestore, ENTRIES_COLLECTION, item.id);
    await updateDoc(docRef, { pageOrder: item.pageOrder, customPageNumber: item.pageOrder, updatedAt: new Date().toISOString() });
  }
  return true;
}

export async function updateFirestoreSettings(updates: Partial<DiarySettings>): Promise<DiarySettings> {
  const docRef = doc(firestore, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
  const snap = await getDoc(docRef);
  const existing = snap.exists() ? snap.data() as DiarySettings : DEFAULT_SETTINGS;

  const newSettings: DiarySettings = {
    ...existing,
    ...updates,
    lastUpdated: new Date().toISOString()
  };

  await setDoc(docRef, newSettings, { merge: true });
  return newSettings;
}

export async function addFirestoreMedia(mediaItem: MediaItem): Promise<MediaItem> {
  await setDoc(doc(firestore, MEDIA_COLLECTION, mediaItem.id), mediaItem);
  return mediaItem;
}

export async function deleteFirestoreMedia(id: string): Promise<boolean> {
  await deleteDoc(doc(firestore, MEDIA_COLLECTION, id));
  return true;
}
