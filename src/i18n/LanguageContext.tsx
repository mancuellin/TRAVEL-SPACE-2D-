import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Language = 'es' | 'en';

const LANG_STORAGE_KEY = 'mk11_lang_v1';
const DEFAULT_LANGUAGE: Language = 'en';

function loadInitialLanguage(): Language {
  try {
    const raw = window.localStorage.getItem(LANG_STORAGE_KEY);
    return raw === 'es' || raw === 'en' ? raw : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

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
  const [lang, setLangState] = useState<Language>(loadInitialLanguage);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next: Language = prev === 'es' ? 'en' : 'es';
      try {
        window.localStorage.setItem(LANG_STORAGE_KEY, next);
      } catch {
        // Ignore storage errors
      }
      return next;
    });
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
