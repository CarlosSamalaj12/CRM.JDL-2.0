import { useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';

const iconMap = {
  success: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="16 8 10 16 7 13"/></svg>,
  error: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  warning: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  info: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
};

export function ToastProvider({ children }) {
  return (
    <>
      {children}
      <Toaster position="top-right" toastOptions={{ style: { borderRadius: '10px', fontWeight: '600', fontSize: '14px', padding: '12px 16px' }, duration: 4000 }} />
    </>
  );
}

export function useToast() {
  const success = useCallback((msg, opts) => {
    toast.success(msg, { duration: opts?.duration || 4000, icon: iconMap.success });
  }, []);

  const error = useCallback((msg, opts) => {
    toast.error(msg, { duration: opts?.duration || 6000, icon: iconMap.error });
  }, []);

  const info = useCallback((msg, opts) => {
    toast(msg, { duration: opts?.duration || 4000, icon: iconMap.info });
  }, []);

  const warning = useCallback((msg, opts) => {
    toast(msg, { duration: opts?.duration || 5000, icon: iconMap.warning });
  }, []);

  return { success, error, info, warning };
}