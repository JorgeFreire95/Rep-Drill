/**
 * Sistema de Caché Simple para Servicios Frontend
 * Implementa caching en memoria con expiración y gestión de tamaño
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class CacheManager {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxSize: number = 100; // Máximo 100 entradas

  /**
   * Obtener dato del caché
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Verificar si expiró
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Guardar dato en caché
   */
  set<T>(key: string, data: T, ttl: number = 60000): void {
    // Si alcanzamos el límite, eliminar la entrada más antigua
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value as string | undefined;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Invalidar caché por key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidar caché por patrón (prefix)
   */
  invalidatePattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Limpiar todo el caché
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Obtener estadísticas del caché
   */
  getStats(): { size: number; maxSize: number; keys: string[] } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Instancia global del caché
export const cacheManager = new CacheManager();

/**
 * Wrapper para cachear funciones async
 * 
 * @example
 * const cachedGetProducts = withCache(
 *   'products',
 *   getProducts,
 *   60000 // 1 minuto
 * );
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withCache<TArgs extends any[], TReturn>(
  keyPrefix: string,
  fn: (...args: TArgs) => Promise<TReturn>,
  ttl: number = 60000
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    // Crear key único basado en argumentos
    const key = `${keyPrefix}:${JSON.stringify(args)}`;

    // Intentar obtener del caché
    const cached = cacheManager.get<TReturn>(key);
    if (cached !== null) {
      console.log(`[Cache HIT] ${key}`);
      return cached;
    }

    // Si no está en caché, ejecutar función
    console.log(`[Cache MISS] ${key}`);
    const result = await fn(...args);

    // Guardar en caché
    cacheManager.set(key, result, ttl);

    return result;
  };
}

/**
 * Hook para React que auto-invalida caché cuando el componente se desmonta
 */
export function useCacheInvalidation(patterns: string[]) {
  if (typeof window !== 'undefined') {
    return () => {
      patterns.forEach(pattern => {
        cacheManager.invalidatePattern(pattern);
      });
    };
  }
  return () => {};
}
