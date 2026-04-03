import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useUrlHistory } from "./useUrlHistory";

// window.storywright のモック
let storedData: Record<string, unknown> = {};

beforeEach(() => {
  storedData = {};
  (window as any).storywright = {
    saveData: vi.fn((filename: string, data: unknown) => {
      storedData[filename] = data;
      return Promise.resolve();
    }),
    loadData: vi.fn((filename: string) => {
      return Promise.resolve(storedData[filename] ?? null);
    }),
  };
});

describe("useUrlHistory", () => {
  it("初期状態では履歴が空", () => {
    const { result } = renderHook(() => useUrlHistory());
    expect(result.current.urlHistory).toEqual([]);
  });

  it("初期 baseUrl はデフォルト値", () => {
    const { result } = renderHook(() => useUrlHistory());
    expect(result.current.baseUrl).toBe("https://example.com");
  });

  it("保存済みデータがあれば復元する", async () => {
    storedData["urlHistory.json"] = {
      lastBaseUrl: "https://mysite.com",
      history: ["https://a.com", "https://b.com"],
    };
    const { result } = renderHook(() => useUrlHistory());
    await waitFor(() => {
      expect(result.current.baseUrl).toBe("https://mysite.com");
    });
    expect(result.current.urlHistory).toEqual(["https://a.com", "https://b.com"]);
  });

  it("setBaseUrl で baseUrl を変更できる", () => {
    const { result } = renderHook(() => useUrlHistory());
    act(() => {
      result.current.setBaseUrl("https://new.com");
    });
    expect(result.current.baseUrl).toBe("https://new.com");
  });

  it("setBaseUrl でファイルに保存される", () => {
    const { result } = renderHook(() => useUrlHistory());
    act(() => {
      result.current.setBaseUrl("https://new.com");
    });
    expect(window.storywright.saveData).toHaveBeenCalledWith(
      "urlHistory.json",
      expect.objectContaining({ lastBaseUrl: "https://new.com" }),
    );
  });

  it("addUrlToHistory で URL が履歴に追加される", () => {
    const { result } = renderHook(() => useUrlHistory());
    act(() => {
      result.current.addUrlToHistory("https://test.com");
    });
    expect(result.current.urlHistory).toEqual(["https://test.com"]);
  });

  it("addUrlToHistory でファイルに保存される", () => {
    const { result } = renderHook(() => useUrlHistory());
    act(() => {
      result.current.addUrlToHistory("https://test.com");
    });
    expect(window.storywright.saveData).toHaveBeenCalledWith(
      "urlHistory.json",
      expect.objectContaining({
        lastBaseUrl: "https://test.com",
        history: ["https://test.com"],
      }),
    );
  });

  it("同じ URL を追加すると先頭に移動する（重複しない）", () => {
    const { result } = renderHook(() => useUrlHistory());
    act(() => {
      result.current.addUrlToHistory("https://a.com");
      result.current.addUrlToHistory("https://b.com");
      result.current.addUrlToHistory("https://a.com");
    });
    expect(result.current.urlHistory).toEqual(["https://a.com", "https://b.com"]);
  });

  it("http:// 以外の URL は追加されない", () => {
    const { result } = renderHook(() => useUrlHistory());
    act(() => {
      result.current.addUrlToHistory("not-a-url");
      result.current.addUrlToHistory("");
    });
    expect(result.current.urlHistory).toEqual([]);
  });

  it("履歴は最大 20 件まで", () => {
    const { result } = renderHook(() => useUrlHistory());
    act(() => {
      for (let i = 0; i < 25; i++) {
        result.current.addUrlToHistory(`https://site-${i}.com`);
      }
    });
    expect(result.current.urlHistory).toHaveLength(20);
    expect(result.current.urlHistory[0]).toBe("https://site-24.com");
  });

  it("deleteUrlFromHistory で特定の URL を削除できる", () => {
    const { result } = renderHook(() => useUrlHistory());
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
