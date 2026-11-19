const LS_KEY = 'quizResults';
const LS_MIGRATED_KEY = 'quizResultsMigrated';
const DB_NAME = 'quizDB';
const DB_VERSION = 1;
const STORE_NAME = 'results';

// Зберігає масив результатів у localStorage як JSON.
function saveToLocalStorage(items) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Не вдалося записати в localStorage:', err);
  }
}

// Читає масив результатів із localStorage; при помилці розбору повертає [].
function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Не вдалося прочитати localStorage:', err);
    return [];
  }
}

// Відкриває базу; при першому запуску створює сховище results.
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Виконує дію над сховищем у транзакції й повертає Promise з результатом.
async function withStore(mode, action) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const request = action(tx.objectStore(STORE_NAME));
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

const addItem = (item) => withStore('readwrite', (store) => store.put(item));
const updateItem = (item) => withStore('readwrite', (store) => store.put(item));
const getAllItems = () => withStore('readonly', (store) => store.getAll());
const deleteItem = (id) => withStore('readwrite', (store) => store.delete(id));

// Одноразово переносить результати з localStorage в IndexedDB.
async function migrateFromLocalStorage() {
  if (localStorage.getItem(LS_MIGRATED_KEY) === 'true') return;

  const existing = await getAllItems();
  const old = loadFromLocalStorage();
  if (existing.length === 0 && old.length > 0) {
    for (const item of old) {
      await addItem(item);
    }
  }
  localStorage.setItem(LS_MIGRATED_KEY, 'true');
}