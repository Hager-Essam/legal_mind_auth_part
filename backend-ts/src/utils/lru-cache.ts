// Simple LRU cache with per-entry TTL
// Uses Map insertion order for eviction (oldest-inserted first)

export class LruCache<K, V> {
  private readonly store = new Map<K, { value: V; expiresAt: number }>();

  constructor(private readonly maxSize: number, private readonly ttlMs: number) {}

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) { this.store.delete(key); return undefined; }
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.store.has(key)) this.store.delete(key);
    if (this.store.size >= this.maxSize) this.store.delete(this.store.keys().next().value as K);
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  get size(): number { return this.store.size; }
}
