import { supabase } from '../lib/supabase';

// VAPID Public Key (we'll generate this later)
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

/**
 * Convert base64 string to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if push notifications are supported
 */
export const isPushSupported = () => {
  return 'serviceWorker' in navigator && 'PushManager' in window;
};

/**
 * Request permission for push notifications
 */
export const requestPushPermission = async () => {
  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

/**
 * Register service worker and subscribe to push
 */
export const subscribeToPush = async () => {
  if (!isPushSupported()) {
    throw new Error('Push notifications not supported');
  }

  // Register service worker
  const registration = await navigator.serviceWorker.register('/sw.js', {
    scope: '/',
  });

  // Wait for service worker to activate
  await navigator.serviceWorker.ready;

  // Get existing subscription
  let subscription = await registration.pushManager.getSubscription();

  // If no subscription, create new one
  if (!subscription) {
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  // Save subscription to Supabase
  await savePushSubscription(subscription);
  return subscription;
};

/**
 * Save subscription to Supabase
 */
export const savePushSubscription = async (subscription) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('push_subscriptions').upsert({
    user_id: user.id,
    subscription,
  });
};

/**
 * Unsubscribe from push notifications
 */
export const unsubscribeFromPush = async () => {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  
  if (subscription) {
    await subscription.unsubscribe();
    
    // Delete from Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id);
    }
  }
};

/**
 * Check if user is subscribed
 */
export const isSubscribed = async () => {
  if (!isPushSupported()) return false;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return !!subscription;
};
