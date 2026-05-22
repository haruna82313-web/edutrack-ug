import { useEffect, useState } from 'react';

// Key for local storage queue
const OFFLINE_QUEUE_KEY = 'edutrack_offline_queue';

/**
 * Adds an action to the offline queue
 * @param {string} type - Action type (e.g., 'MARK_ATTENDANCE')
 * @param {object} payload - Action data
 */
export const queueOfflineAction = (type, payload) => {
  const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  queue.push({
    id: crypto.randomUUID(),
    type,
    payload,
    timestamp: new Date().toISOString()
  });
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
};

/**
 * Hook to monitor online/offline status
 */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

/**
 * Hook to handle syncing when online
 */
export const useOfflineSync = (syncCallback) => {
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (isOnline) {
      const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
      if (queue.length > 0 && syncCallback) {
        syncCallback(queue).then((success) => {
          if (success) {
            localStorage.setItem(OFFLINE_QUEUE_KEY, '[]');
          }
        });
      }
    }
  }, [isOnline, syncCallback]);

  return { isOnline, queueLength: JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]').length };
};
