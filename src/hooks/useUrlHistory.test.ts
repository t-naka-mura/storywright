import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useUrlHistory } from "./useUrlHistory";

// window.storywright のモック
let storedData: Record<string, unknown> = {};

beforeEach(() => {
  storedData = {};
  (window as any).storywright = {
    saveLocalState: vi.fn((key: string, data: unknown) => {
      storedData[key] = data;
      return Promise.resolve();
    }),
    loadLocalState: vi.fn((key: string) => {
      return Promise.resolve(storedData[key] ?? null);
    }),
  };
});

describe("useUrlHistory", () => {
  it("初期状態では履歴が空", async () => {
    const { result } = renderHook(() => useUrlHistory());
    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });
    expect(result.current.urlHistory).toEqual([]);
  });

  it("初期 baseUrl はデフォルト値", async () => {
    const { result } = renderHook(() => useUrlHistory());
    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });
    expect(result.current.baseUrl).toBe("https://example.com");
  });

  it("保存済みデータがあれば復元する", async () => {
    storedData.urlHistory = {
      lastBaseUrl: "https://mysite.com",
      history: ["https://a.com", "https://b.com"],
    };
    const { result } = renderHook(() => useUrlHistory());
    await waitFor(() => {
      expect(result.current.baseUrl).toBe("https://mysite.com");
    });
    expect(result.current.urlHistory).toEqual(["https://a.com", "https://b.com"]);
  });

  it("setBaseUrl で baseUrl を変更できる", async () => {
    const { result } = renderHook(() => useUrlHistory());
    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });
    act(() => {
      result.current.setBaseUrl("https://new.com");
    });
    expect(result.current.baseUrl).toBe("https://new.com");
  });

  it("setBaseUrl でファイルに保存される", async () => {
    const { result } = renderHook(() => useUrlHistory());
    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });
    act(() => {
      result.current.setBaseUrl("https://new.com");
    });
    expect(window.storywright.saveLocalState).toHaveBeenCalledWith(
      "urlHistory",
      expect.objectContaining({ lastBaseUrl: "https://new.com" }),
    );
  });

  it("addUrlToHistory で URL が履歴に追加される", async () => {
    const { result } = renderHook(() => useUrlHistory());
    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });
    act(() => {
      result.current.addUrlToHistory("https://test.com");
    });
    expect(result.current.urlHistory).toEqual(["https://test.com"]);
  });

  it("addUrlToHistory でファイルに保存される", async () => {
    const { result } = renderHook(() => useUrlHistory());
    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });
    act(() => {
      result.current.addUrlToHistory("https://test.com");
    });
    expect(window.storywright.saveLocalState).toHaveBeenCalledWith(
      "urlHistory",
      expect.objectContaining({
        lastBaseUrl: "https://test.com",
        history: ["https://test.com"],
      }),
    );
  });

  it("同じ URL を追加すると先頭に移動する（重複しない）", async () => {
    const { result } = renderHook(() => useUrlHistory());
    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });
    act(() => {
      result.current.addUrlToHistory("https://a.com");
      result.current.addUrlToHistory("https://b.com");
      result.current.addUrlToHistory("https://a.com");
    });
    expect(result.current.urlHistory).toEqual(["https://a.com", "https://b.com"]);
  });

  it("http:// 以外の URL は追加されない", async () => {
    const { result } = renderHook(() => useUrlHistory());
    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });
    act(() => {
      result.current.addUrlToHistory("not-a-url");
      result.current.addUrlToHistory("");
    });
    expect(result.current.urlHistory).toEqual([]);
  });

  it("履歴は最大 20 件まで", async () => {
    const { result } = renderHook(() => useUrlHistory());
    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });
    act(() => {
      for (let i = 0; i < 25; i++) {
        result.current.addUrlToHistory(`https://site-${i}.com`);
      }
    });
    expect(result.current.urlHistory).toHaveLength(20);
    expect(result.current.urlHistory[0]).toBe("https://site-24.com");
  });

  it("deleteUrlFromHistory で特定の URL を削除できる", async () => {
    const { result } = renderHook(() => useUrlHistory());
    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });
    act(() => {
      result.current.addUrlToHistory("https://a.com");
      result.current.addUrlToHistory("https://b.com");
    });
    act(() => {
      result.current.deleteUrlFromHistory("https://a.com");
    });
    expect(result.current.urlHistory).toEqual(["https://b.com"]);
  });
});
