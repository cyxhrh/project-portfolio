import type { SpecimenRecord } from "../domain/specimen";

const DATABASE_VERSION = 1;
const STORE_NAME = "specimens";

export interface SpecimenRepository {
  save(specimen: SpecimenRecord): Promise<void>;
  get(id: string): Promise<SpecimenRecord | undefined>;
  list(): Promise<SpecimenRecord[]>;
  remove(id: string): Promise<void>;
}

interface RepositoryOptions {
  indexedDB?: IDBFactory | null;
  databaseName?: string;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB 请求失败。"));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB 事务失败。"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB 事务已中止。"));
  });
}

function openDatabase(factory: IDBFactory, databaseName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(databaseName, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("无法打开本地标本馆。"));
    request.onblocked = () => reject(new Error("本地标本馆正在被另一个页面占用。"));
  });
}

export function createSpecimenRepository(
  options: RepositoryOptions = {},
): SpecimenRepository {
  const factory = Object.hasOwn(options, "indexedDB")
    ? options.indexedDB
    : globalThis.indexedDB;
  const databaseName = options.databaseName ?? "glimmer-specimen-museum";

  if (!factory) {
    const unavailable = () =>
      Promise.reject(new Error("当前浏览器不支持 IndexedDB，无法保存标本。"));

    return {
      save: unavailable,
      get: unavailable,
      list: unavailable,
      remove: unavailable,
    };
  }

  const databaseFactory = factory;

  async function withStore<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const database = await openDatabase(databaseFactory, databaseName);

    try {
      const transaction = database.transaction(STORE_NAME, mode);
      const completed = transactionComplete(transaction);
      const [result] = await Promise.all([
        requestResult(operation(transaction.objectStore(STORE_NAME))),
        completed,
      ]);
      return result;
    } finally {
      database.close();
    }
  }

  return {
    async save(specimen) {
      await withStore("readwrite", (store) => store.put(specimen));
    },

    async get(id) {
      return withStore("readonly", (store) => store.get(id));
    },

    async list() {
      const specimens = await withStore("readonly", (store) => store.getAll());
      return specimens.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async remove(id) {
      await withStore("readwrite", (store) => store.delete(id));
    },
  };
}
