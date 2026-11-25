import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";

export type AppLang = "el" | "en";

export const APP_LANG_STORAGE_KEY = "wortwerk-app-lang";

export interface AppLanguageContextValue {
  lang: AppLang;
  isEn: boolean;
  setLang: (next: AppLang) => void;
  t: (el: string, en: string) => string;
}

const DEFAULT_CONTEXT: AppLanguageContextValue = {
  lang: "el",
  isEn: false,
  setLang: () => {},
  t: (el: string) => el,
};

const AppLanguageContext = createContext<AppLanguageContextValue>(DEFAULT_CONTEXT);

function readInitialLang(): AppLang {
  if (typeof window === "undefined") return "el";
  try {
    const stored = window.localStorage.getItem(APP_LANG_STORAGE_KEY);
    if (stored === "en" || stored === "el") return stored;
  } catch {
    // Ignore storage read errors
  }
  return "el";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<AppLang>(() => readInitialLang());

  const setLang = useCallback((next: AppLang) => {
    setLangState(next);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(APP_LANG_STORAGE_KEY, next);
      } catch {
        // Ignore storage write errors
      }
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const value = useMemo<AppLanguageContextValue>(
    () => ({
      lang,
      isEn: lang === "en",
      setLang,
      t: (el: string, en: string) => (lang === "en" ? en : el),
    }),
    [lang, setLang],
  );

  return <AppLanguageContext.Provider value={value}>{children}</AppLanguageContext.Provider>;
}

export function useAppLang(): AppLanguageContextValue {
  return useContext(AppLanguageContext);
}

export interface WordLike {
  meaning?: {
    greek?: string[];
    english?: string[];
  };
}

export function wordPrimaryMeanings(word: WordLike | null | undefined, lang: AppLang): string[] {
  const greek = (word?.meaning?.greek || []).filter(Boolean);
  const english = (word?.meaning?.english || []).filter(Boolean);
  if (lang === "en") {
    return english.length > 0 ? english : greek;
  }
  return greek.length > 0 ? greek : english;
}

export function wordSecondaryMeanings(word: WordLike | null | undefined, lang: AppLang): string[] {
  const greek = (word?.meaning?.greek || []).filter(Boolean);
  const english = (word?.meaning?.english || []).filter(Boolean);
  if (lang === "en") {
    return english.length > 0 ? greek : [];
  }
  return greek.length > 0 ? english : [];
}

export interface SentenceMeaningLike {
  meaning?: {
    el?: string;
    en?: string;
  };
}

export function sentencePrimaryMeaning(
  entry: SentenceMeaningLike | null | undefined,
  lang: AppLang,
): string {
  const el = entry?.meaning?.el?.trim() || "";
  const en = entry?.meaning?.en?.trim() || "";
  if (lang === "en") return en || el;
  return el || en;
}

export function sentenceSecondaryMeaning(
  entry: SentenceMeaningLike | null | undefined,
  lang: AppLang,
): string {
  const el = entry?.meaning?.el?.trim() || "";
  const en = entry?.meaning?.en?.trim() || "";
  if (lang === "en") return en && el ? el : "";
  return el && en ? en : "";
}
