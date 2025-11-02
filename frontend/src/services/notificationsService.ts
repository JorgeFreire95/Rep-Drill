import { inventarioService } from './inventarioService';
import type { LowStockCountResponse } from '../types';

export type LowStockSnapshot = Pick<
  LowStockCountResponse,
  'count' | 'critical' | 'high' | 'medium' | 'has_critical'
>;

export interface LowStockWatcherOptions {
  intervalMs?: number;
  onUpdate?: (prev: LowStockSnapshot | null, next: LowStockSnapshot) => void;
  getCount?: () => Promise<LowStockCountResponse>; // for testing / DI
}

export function startLowStockWatcher(options: LowStockWatcherOptions = {}) {
  const intervalMs = options.intervalMs ?? 10000; // 10s por defecto
  const getCount = options.getCount ?? inventarioService.getLowStockCount;

  let timer: ReturnType<typeof setInterval> | null = null;
  let prev: LowStockSnapshot | null = null;
  let stopped = false;

  const tick = async () => {
    try {
      const data = await getCount();
      const next: LowStockSnapshot = {
        count: data.count,
        critical: data.critical,
        high: data.high,
        medium: data.medium,
        has_critical: data.has_critical,
      };

      if (!prev || hasChanged(prev, next)) {
        // Emitir evento global para que otras vistas se actualicen
        window.dispatchEvent(
          new CustomEvent('low-stock-alert', { detail: { prev, next } })
        );

        options.onUpdate?.(prev, next);
        prev = next;
      }
    } catch (err) {
      // Silencioso: no saturar con errores de red intermitentes
      // console.debug('LowStockWatcher error', err);
    }
  };

  // Primera ejecución inmediata
  tick();
  // Intervalo
  timer = setInterval(() => {
    if (!stopped) tick();
  }, intervalMs);

  return () => {
    stopped = true;
    if (timer) clearInterval(timer);
  };
}

function hasChanged(a: LowStockSnapshot, b: LowStockSnapshot) {
  return (
    a.count !== b.count ||
    a.critical !== b.critical ||
    a.high !== b.high ||
    a.medium !== b.medium ||
    a.has_critical !== b.has_critical
  );
}
