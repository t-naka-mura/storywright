import { useState, useCallback, useEffect, useRef } from "react";

const FILENAME = "urlHistory.json";
const MAX_HISTORY = 20;
const DEFAULT_URL = "https://example.com";

interface UrlHistoryData {
  lastBaseUrl: string;
  history: string[];
}

export function useUrlHistory() {
  const [baseUrl, setBaseUrlState] = useState(DEFAULT_URL);
  const [urlHistory, setUrlHistory] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const dataRef = useRef<UrlHistoryData>({ lastBaseUrl: DEFAULT_URL, history: [] });

  // 起動時にファイルから読み込み
  useEffect(() => {
    async function load() {
      const saved = await window.storywright.loadData(FILENAME) as UrlHistoryData | null;
      if (saved) {
        setBaseUrlState(saved.lastBaseUrl || DEFAULT_URL);
        setUrlHistory(saved.history || []);
        dataRef.current = saved;
      }
      setLoaded(true);
    }
    load();
  }, []);

  // ファイルへの永続化
  const persist = useCallback((data: UrlHistoryData) => {
    dataRef.current = data;
    window.storywright.saveData(FILENAME, data);
  }, []);

  const setBaseUrl = useCallback((url: string) => {
    setBaseUrlState(url);
    if (url) {
      persist({ ...dataRef.current, lastBaseUrl: url });
    }
  }, [persist]);

  const addUrlToHistory = useCallback((url: string) => {
    if (!url || !/^https?:\/\//.test(url)) return;
    setUrlHistory((prev) => {
      const filtered = prev.filter((u) => u !== url);
      const next = [url, ...filtered].slice(0, MAX_HISTORY);
      persist({ lastBaseUrl: url, history: next });
      return next;
    });
    setBaseUrlState(url);
  }, [persist]);

  const deleteUrlFromHistory = useCallback((url: string) => {
    setUrlHistory((prev) => {
      const next = prev.filter((u) => u !== url);
      persist({ ...dataRef.current, history: next });
      return next;
    });
  }, [persist]);

  return {
    baseUrl,
    setBaseUrl,
    urlHistory,
    addUrlToHistory,
    deleteUrlFromHistory,
    loaded,
  };
}
