import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

/**
 * Prompts users to install EduTrack as an app (Chrome, Edge, Android).
 */
const InstallPwa = () => {
  const [promptEvent, setPromptEvent] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setIsStandalone(standalone);

    if (sessionStorage.getItem('edutrack-pwa-dismissed')) {
      setDismissed(true);
    }

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setPromptEvent(e);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const handleInstall = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    setPromptEvent(null);
    setDismissed(true);
    sessionStorage.setItem('edutrack-pwa-dismissed', '1');
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('edutrack-pwa-dismissed', '1');
  };

  if (isStandalone || dismissed || !promptEvent) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[150] md:left-auto md:right-6 md:max-w-sm animate-in slide-in-from-bottom-4 duration-500">
      <div className="glass-card p-5 border-aurora-cyan/30 shadow-neon-cyan flex gap-4 items-start">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-aurora-cyan to-aurora-violet flex items-center justify-center shrink-0 font-black text-white">
          E
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black text-aurora-cyan uppercase tracking-widest">Install app</p>
          <p className="text-sm text-slate-300 mt-1 leading-snug">
            Add EduTrack to your home screen for quick access like a native app.
          </p>
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={handleInstall}
              className="btn-primary py-2.5 px-4 text-[10px] flex items-center gap-2"
            >
              <Download size={14} /> Install
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white hover:bg-white/10"
            >
              Later
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-slate-500 hover:text-white p-1"
          aria-label="Dismiss"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

export default InstallPwa;
