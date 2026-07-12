// happy-dom 20 doesn't expose localStorage as a global in vitest by default.
// Provide a minimal in-memory implementation so stores that read/write it work.
const store = new Map<string, string>();

class LocalStorage {
  getItem(key: string): string | null {
    return store.has(key) ? store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    store.set(key, String(value));
  }
  removeItem(key: string): void {
    store.delete(key);
  }
  clear(): void {
    store.clear();
  }
  key(index: number): string | null {
    return [...store.keys()][index] ?? null;
  }
  get length(): number {
    return store.size;
  }
}

if (typeof globalThis.localStorage === "undefined") {
  (globalThis as any).localStorage = new LocalStorage();
}
if (typeof (globalThis as any).window !== "undefined" && !(globalThis as any).window.localStorage) {
  (globalThis as any).window.localStorage = globalThis.localStorage;
}