// ---------------------------------------------------------------------------
// IndexedDB layer for offline order entry.
//   • store "items" : product list cached from the cloud (keyed by ItemID)
//   • store "queue" : orders entered offline, awaiting cloud push (keyed by Id)
// Promise-based, dependency-free.
// ---------------------------------------------------------------------------
window.EpalaceDB = (function () {
    const DB_NAME = 'epalace-offline';
    const DB_VERSION = 1;
    let dbPromise = null;

    function open() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains('items')) {
                    db.createObjectStore('items', { keyPath: 'ItemID' });
                }
                if (!db.objectStoreNames.contains('queue')) {
                    db.createObjectStore('queue', { keyPath: 'Id' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        return dbPromise;
    }

    function tx(store, mode, fn) {
        return open().then(db => new Promise((resolve, reject) => {
            const t = db.transaction(store, mode);
            const os = t.objectStore(store);
            const out = fn(os);
            t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
            t.onerror = () => reject(t.error);
            t.onabort = () => reject(t.error);
        }));
    }

    function getAll(store) {
        return open().then(db => new Promise((resolve, reject) => {
            const req = db.transaction(store, 'readonly').objectStore(store).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        }));
    }

    return {
        // Items
        saveItems: (items) => tx('items', 'readwrite', os => { items.forEach(i => os.put(i)); }),
        getItems: () => getAll('items'),
        // Queue
        enqueueOrder: (order) => tx('queue', 'readwrite', os => { os.put(order); }),
        getQueue: () => getAll('queue'),
        removeQueued: (id) => tx('queue', 'readwrite', os => { os.delete(id); }),
        clearQueue: () => tx('queue', 'readwrite', os => { os.clear(); })
    };
})();
