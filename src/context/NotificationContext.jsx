import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notification, setNotification] = useState(null);

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  const hideNotification = useCallback(() => {
    setNotification(null);
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      {notification && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] w-full max-w-sm px-4 animate-in slide-in-from-bottom-6 duration-500">
          <div className={`glass-card p-4 flex gap-4 items-center border shadow-2xl ${
            notification.type === 'error' ? 'border-rose-500/30 shadow-rose-500/10' : 
            notification.type === 'info' ? 'border-blue-500/30 shadow-blue-500/10' :
            'border-aurora-cyan/30 shadow-neon-cyan'
          }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              notification.type === 'error' ? 'bg-rose-500/10 text-rose-400' : 
              notification.type === 'info' ? 'bg-blue-500/10 text-blue-400' :
              'bg-aurora-cyan/10 text-aurora-cyan'
            }`}>
              {notification.type === 'error' ? <XCircle size={20} /> : 
               notification.type === 'info' ? <Info size={20} /> : 
               <CheckCircle2 size={20} />}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className={`text-[10px] font-black uppercase tracking-widest ${
                notification.type === 'error' ? 'text-rose-400' : 
                notification.type === 'info' ? 'text-blue-400' :
                'text-aurora-cyan'
              }`}>
                {notification.type === 'error' ? 'Alert' : 
                 notification.type === 'info' ? 'Information' : 
                 'Success'}
              </p>
              <p className="text-xs text-slate-300 mt-1 font-medium leading-relaxed">
                {notification.message}
              </p>
            </div>

            <button
              onClick={hideNotification}
              className="text-slate-500 hover:text-white p-1 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};
