import { useEffect, useState } from 'react';

type InventoryUpdateListener = () => void;

class InventoryUpdateManager {
  private listeners: Set<InventoryUpdateListener> = new Set();

  subscribe(listener: InventoryUpdateListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify() {
    this.listeners.forEach(listener => listener());
  }
}

export const inventoryUpdateManager = new InventoryUpdateManager();

/**
 * Hook para escuchar actualizaciones del inventario desde otras partes de la aplicación
 */
export const useInventoryUpdates = (onUpdate?: () => void) => {
  const [updateCount, setUpdateCount] = useState(0);

  useEffect(() => {
    const unsubscribe = inventoryUpdateManager.subscribe(() => {
      setUpdateCount(count => count + 1);
      onUpdate?.();
    });

    return unsubscribe;
  }, [onUpdate]);

  return {
    updateCount,
    notifyInventoryUpdate: () => inventoryUpdateManager.notify()
  };
};

/**
 * Hook específico para notificar actualizaciones del inventario
 */
export const useInventoryNotifier = () => {
  return {
    notifyInventoryUpdate: () => inventoryUpdateManager.notify()
  };
};