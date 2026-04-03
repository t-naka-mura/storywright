import { useState, useCallback } from "react";

const STORAGE_KEY_HISTORY = "storywright:urlHistory";
const STORAGE_KEY_LAST = "storywright:lastBaseUrl";
const MAX_HISTORY = 20;
const DEFAULT_URL = "https://example.com";

export function useUrlHistory() {
  const [baseUrl, setBaseUrlState] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_LAST) || DEFAULT_URL;
  });

  const setBaseUrl = useCallback((url: string) => {
    setBaseUrlState(url);
    if (url) localStorage.setItem(STORAGE_KEY_LAST, url);
  }, []);

  const [urlHistory, setUrlHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || "[]");
    } catch {
      return [];
    }
  });

  const addUrlToHistory = useCallback((url: string) => {
    if (!url || !/^https?:\/\//.test(url)) return;
    setUrlHistory((prev) => {
      const filtered = prev.filter((u) => u !== url);
      const next = [url, ...filtered].slice(0, MAX_HISTORY);
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(next));
      return next;
    });
    localStorage.setItem(STORAGE_KEY_LAST, url);
  }, []);

  const deleteUrlFromHistory = useCallback((url: string) => {
    setUrlHistory((prev) => {
      const next = prev.filter((u) => u !== url);
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(next));
      return next;
    });
  }, []);

  return {
    baseUrl,
    setBaseUrl,
    urlHistory,
    addUrlToHistory,
    deleteUrlFromHistory,
  };
}
