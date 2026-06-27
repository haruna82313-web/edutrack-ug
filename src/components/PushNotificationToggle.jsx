import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import {
  isPushSupported,
  requestPushPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isSubscribed,
} from '../utils/push-notifications';

export function PushNotificationToggle() {
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      const subscribedStatus = await isSubscribed();
      setSubscribed(subscribedStatus);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!subscribed) {
        const permissionGranted = await requestPushPermission();
        if (!permissionGranted) {
          setError('Please allow notifications to continue');
          return;
        }
        await subscribeToPush();
        setSubscribed(true);
      } else {
        await unsubscribeFromPush();
        setSubscribed(false);
      }
    } catch (err) {
      console.error(err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isPushSupported()) {
    return (
      <div className="text-sm text-slate-500">
        Push notifications are not supported in this browser
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {loading ? (
          <Loader2 className="animate-spin text-primary-500" size={18} />
        ) : subscribed ? (
          <Bell className="text-emerald-500" size={18} />
        ) : (
          <BellOff className="text-slate-400" size={18} />
        )}
        <span className="text-[10px] lg:text-xs font-black text-slate-200 uppercase tracking-widest">
          Push Notifications
        </span>
      </div>

      <button
        onClick={handleToggle}
        disabled={loading}
        className={`px-4 py-2 rounded-xl text-[9px] lg:text-xs font-semibold transition-all ${
          loading
            ? 'opacity-50 cursor-not-allowed'
            : subscribed
            ? 'bg-slate-700 hover:bg-slate-600 text-white'
            : 'bg-primary-600 hover:bg-primary-500 text-white'
        }`}
      >
        {subscribed ? 'Unsubscribe' : 'Subscribe'}
      </button>

      {error && (
        <div className="text-[9px] text-aurora-rose mt-1">{error}</div>
      )}
    </div>
  );
}
