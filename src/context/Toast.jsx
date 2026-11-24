import { createContext, useCallback, useContext, useRef, useState } from 'react';

const Ctx = createContext(() => {});
export const useToast = () => useContext(Ctx);

// toast(testo, { action: { label, onClick }, error })
export function ToastProvider({ children }) {
  const [t, setT] = useState(null);
  const timer = useRef();
  const toast = useCallback((text, opts = {}) => {
    clearTimeout(timer.current);
    setT({ text, ...opts });
    timer.current = setTimeout(() => setT(null), opts.action ? 8000 : 3500);
  }, []);
  return (
    <Ctx.Provider value={toast}>
      {children}
      {t && (
        <div className={`toast ${t.error ? 'err' : ''}`} role="status">
          <span>{t.text}</span>
          {t.action && (
            <button onClick={() => { t.action.onClick(); setT(null); }}>{t.action.label}</button>
          )}
        </div>
      )}
    </Ctx.Provider>
  );
}
