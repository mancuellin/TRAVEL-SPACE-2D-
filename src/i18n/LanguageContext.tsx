import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Language = 'es' | 'en';

const DEFAULT_LANGUAGE: Language = 'en';

interface LanguageContextValue {
  lang: Language;
  setLang: (next: Language) => void;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: DEFAULT_LANGUAGE,
  setLang: () => {},
  toggleLang: () => {},
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [lang, setLang] = useState<Language>(DEFAULT_LANGUAGE);

  const toggleLang = useCallback(() => {
    setLang((prev) => (prev === 'es' ? 'en' : 'es'));
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.title =
        lang === 'en'
          ? 'Mission MK11 — The Travel Space 2D'
          : 'Misión MK11 — The Travel Space 2D';
    }
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
