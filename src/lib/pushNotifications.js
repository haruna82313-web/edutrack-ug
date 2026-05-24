import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = 'BIsSCx8XxIPLuzxtuoCza9TIdF3n2dJ5IHMqrWzsYnz7N3pkKDueDGTsS7sxREYE849kUd6fxcEZwdnqolcyBBU'; // Placeholder

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

export const subscribeUserToPush = async (userId) => {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Push notifications are not supported on this browser.');
    }

    const registration = await navigator.serviceWorker.ready;
    
    // Check if already subscribed
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      // Refresh it in DB just in case
      await saveSubscriptionToDb(userId, existingSubscription);
      return existingSubscription;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    await saveSubscriptionToDb(userId, subscription);
    return subscription;
  } catch (error) {
    console.error('Push subscription error:', error);
    throw error;
  }
};

const saveSubscriptionToDb = async (userId, subscription) => {
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      subscription: subscription.toJSON()
    }, { onConflict: 'user_id, subscription' });

  if (error) throw error;
};

export const unsubscribeUserFromPush = async (userId) => {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('subscription->>endpoint', subscription.endpoint);
        
      if (error) throw error;
    }
  } catch (error) {
    console.error('Push unsubscription error:', error);
    throw error;
  }
};
