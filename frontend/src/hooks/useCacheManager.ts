/**
 * Hook para gestión de caché distribuido
 * Sincroniza datos con Redis a través del backend
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import api from '../services/api';

export interface CacheEntry {
  key: string;
  value: unknown;
  ttl: number;
  expires_at: string;
  size_bytes: number;
}

export interface CacheStats {
  total_keys: number;
  total_memory_mb: number;
  hit_rate: number;
  eviction_policy: string;
  used_memory_percentage: number;
  entries: CacheEntry[];
}

export const useCacheManager = () => {
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const localCache = useRef(new Map<string, { value: unknown; expires: number }>());

  /**
   * Obtener estadísticas de caché
   */
  const getCacheStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<CacheStats>('/api/cache/stats/');
      setCacheStats(response.data);
      return response.data;
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : 'Error al obtener estadísticas de caché';
      setError(errorMsg);
      console.warn('Cache stats unavailable, using local cache only');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Obtener valor del caché (local primero, luego backend)
   */
  const getCache = useCallback(
    async <T,>(key: string, fetchFn?: () => Promise<T>): Promise<T | null> => {
      // Verificar caché local
      const cached = localCache.current.get(key);
      if (cached && cached.expires > Date.now()) {
        return cached.value as T;
      }

      // Eliminar del caché local si expiró
      if (cached) {
        localCache.current.delete(key);
      }

      // Si hay función de fetch, obtener datos frescos
      if (fetchFn) {
        try {
          const data = await fetchFn();
          const expires = Date.now() + 3600 * 1000;
          localCache.current.set(key, { value: data, expires });
          return data;
        } catch (error) {
          console.error(`Error fetching cache key ${key}:`, error);
          return null;
        }
      }

      return null;
    },
    []
  );

  /**
   * Establecer valor en caché
   */
  const setCache = useCallback(
    (key: string, value: unknown, ttlSeconds = 3600) => {
      const expires = Date.now() + ttlSeconds * 1000;
      localCache.current.set(key, { value, expires });
      return true;
    },
    []
  );

  /**
   * Eliminar clave del caché
   */
  const deleteCache = useCallback((key: string) => {
    localCache.current.delete(key);
    return true;
  }, []);

  /**
   * Limpiar todo el caché local
   */
  const clearCache = useCallback(() => {
    localCache.current.clear();
    return true;
  }, []);

  /**
   * Obtener tamaño del caché local (bytes)
   */
  const getLocalCacheSize = useCallback(() => {
    let totalSize = 0;
    localCache.current.forEach(({ value }: { value: unknown }) => {
      totalSize += JSON.stringify(value).length;
    });
    return totalSize;
  }, []);

  /**
   * Obtener información detallada del caché
   */
  const getCacheInfo = useCallback(() => {
    const entries: CacheEntry[] = [];
    let totalSize = 0;

    localCache.current.forEach(
      (
        { value, expires }: { value: unknown; expires: number },
        key: string
      ) => {
        const size = JSON.stringify(value).length;
        totalSize += size;
        const ttl = Math.max(0, Math.floor((expires - Date.now()) / 1000));

        entries.push({
          key,
          value,
          ttl,
          expires_at: new Date(expires).toISOString(),
          size_bytes: size,
        });
      }
    );

    return {
      total_keys: localCache.current.size,
      total_memory_mb: totalSize / (1024 * 1024),
      entries,
      local_only: true,
    };
  }, []);

  /**
   * Monitorear y limpiar caché expirado
   */
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const expiredKeys: string[] = [];

      localCache.current.forEach(
        (
          { expires }: { expires: number },
          key: string
        ) => {
          if (expires < now) {
            expiredKeys.push(key);
          }
        }
      );

      expiredKeys.forEach((key) => localCache.current.delete(key));

      if (expiredKeys.length > 0) {
        console.log(`Limpié ${expiredKeys.length} claves expiradas del caché`);
      }
    }, 60000); // Cada minuto

    return () => clearInterval(interval);
  }, []);

  /**
   * Precarga de datos comunes
   */
  const preloadCommonData = useCallback(async () => {
    const commonKeys = ['services_list', 'user_profile', 'app_settings'];
    const results = new Map<string, boolean>();

    for (const key of commonKeys) {
      try {
        // Intentar obtener del backend
        const response = await api.get(`/api/cache/${key}/`);
        setCache(key, response.data, 1800); // 30 min TTL
        results.set(key, true);
      } catch {
        // Silencio: continuar si falla
        results.set(key, false);
      }
    }

    return results;
  }, [setCache]);

  return {
    getCacheStats,
    getCache,
    setCache,
    deleteCache,
    clearCache,
    getLocalCacheSize,
    getCacheInfo,
    preloadCommonData,
    cacheStats,
    loading,
    error,
  };
};
