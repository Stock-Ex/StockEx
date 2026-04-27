/**
 * In-Memory Cache mit TTL (Time-To-Live)
 * Einfache LRU-ähnliche Implementierung für serverseitiges Caching
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

export class InMemoryCache {
  private cache = new Map<string, CacheEntry<any>>()
  private maxSize: number
  private defaultTTL: number  // in milliseconds

  constructor(maxSize: number = 1000, defaultTTL: number = 3600000) {  // 1h default
    this.maxSize = maxSize
    this.defaultTTL = defaultTTL
  }

  /**
   * Generiert Cache-Key aus Parametern
   */
  static hashKey(...parts: (string | number)[]): string {
    return parts.join(':')
  }

  /**
   * Setzt Wert im Cache mit TTL
   */
  set<T>(key: string, value: T, ttlMs?: number): void {
    // Evict wenn zu groß
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest()
    }

    const expiresAt = Date.now() + (ttlMs ?? this.defaultTTL)
    this.cache.set(key, { data: value, expiresAt })
  }

  /**
   * Holt Wert aus Cache (null wenn expired oder nicht vorhanden)
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // Prüfe Expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Prüft ob Key existiert und noch nicht expired
   */
  has(key: string): boolean {
    return this.get(key) !== null
  }

  /**
   * Entfernt Key aus Cache
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Entfernt ältesten Eintrag (einfache LRU)
   */
  private evictOldest(): void {
    let oldestKey: string | null = null
    let oldestExpires = Infinity

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < oldestExpires) {
        oldestExpires = entry.expiresAt
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  /**
   * Bereinigt expired Einträge
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Gibt Cache-Größe zurück
   */
  size(): number {
    return this.cache.size
  }

  /**
   * Leert Cache komplett
   */
  clear(): void {
    this.cache.clear()
  }
}

/**
 * Request-Dedupe: Verhindert parallele identische Requests
 */
export class RequestDedupe {
  private inflight = new Map<string, Promise<any>>()

  /**
   * Führt Request aus oder gibt existierenden Promise zurück
   */
  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key)
    if (existing) {
      return existing as Promise<T>
    }

    const promise = fn().finally(() => {
      this.inflight.delete(key)
    })

    this.inflight.set(key, promise)
    return promise
  }

  /**
   * Entfernt Key aus inflight (für manuelles Cleanup)
   */
  clear(key: string): void {
    this.inflight.delete(key)
  }

  /**
   * Leert alle inflight Requests
   */
  clearAll(): void {
    this.inflight.clear()
  }
}

// Singleton Instanzen für serverseitige Nutzung
export const globalCache = new InMemoryCache(1000, 3600000)  // 1h default TTL
export const requestDedupe = new RequestDedupe()

// Cleanup alle 5 Minuten
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    globalCache.cleanup()
  }, 5 * 60 * 1000)
}
