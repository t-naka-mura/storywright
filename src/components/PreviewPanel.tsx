import { useState, useRef, useEffect, useCallback } from "react";
import type { PreviewState, PreviewTabState } from "../types";

interface PreviewPanelProps {
  url: string;
  isRecording: boolean;
  isRunning: boolean;
  recordedStepCount: number;
  onUrlChange: (url: string) => void;
  urlHistory: string[];
  onDeleteUrlHistory: (url: string) => void;
  onUrlLoaded?: (url: string) => void;
}

export function PreviewPanel({
  url,
  isRecording,
  isRunning,
  recordedStepCount,
  onUrlChange,
  urlHistory,
  onDeleteUrlHistory,
  onUrlLoaded,
}: PreviewPanelProps) {
  const [previewState, setPreviewState] = useState<PreviewState>({
    tabs: [],
    activeTabId: null,
  });
  const [barUrl, setBarUrl] = useState(url);
  const [isEditing, setIsEditing] = useState(false);
  const [showUrlDropdown, setShowUrlDropdown] = useState(false);
  const urlBarRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const lastLoadedUrlRef = useRef<string>("");
  const lastAppliedExternalUrlRef = useRef<string | null>(null);

  const activeTab: PreviewTabState | null =
    previewState.tabs.find((tab) => tab.id === previewState.activeTabId) ?? null;
  const hasActiveUrl = !!activeTab?.url;

  useEffect(() => {
    const unsubscribe = window.storywright.onPreviewState((state) => {
      setPreviewState(state);
    });

    window.storywright.getPreviewState().then((state) => {
      setPreviewState(state);
    }).catch(() => {});

    return unsubscribe;
  }, []);

  useEffect(() => {
    const node = previewContainerRef.current;
    if (!node) return;

    const syncBounds = () => {
      const rect = node.getBoundingClientRect();
      window.storywright.setPreviewBounds({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      }).catch(() => {});
    };

    syncBounds();

    const observer = new ResizeObserver(syncBounds);
    observer.observe(node);
    window.addEventListener("resize", syncBounds);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncBounds);
    };
  }, []);

  useEffect(() => {
    if (!isEditing) {
      setBarUrl(activeTab?.url || url);
    }
  }, [activeTab?.id, activeTab?.url, url, isEditing]);

  useEffect(() => {
    lastAppliedExternalUrlRef.current = null;
  }, [previewState.activeTabId]);

  useEffect(() => {
    if (!url || !/^https?:\/\//.test(url) || isEditing) return;
    if (!previewState.activeTabId) {
      if (previewState.tabs.length > 0) return;
      lastAppliedExternalUrlRef.current = url;
      window.storywright.createPreviewTab(url).catch(() => {
        lastAppliedExternalUrlRef.current = null;
      });
      return;
    }
    if (lastAppliedExternalUrlRef.current === url) return;
    lastAppliedExternalUrlRef.current = url;
    if (activeTab?.url !== url) {
      window.storywright.loadPreviewUrl(url).catch(() => {
        lastAppliedExternalUrlRef.current = null;
      });
    }
  }, [url, isEditing, previewState.activeTabId, previewState.tabs.length, activeTab?.url]);

  useEffect(() => {
    if (!onUrlLoaded || !activeTab?.url || activeTab.loading) return;
    if (lastLoadedUrlRef.current === activeTab.url) return;
    lastLoadedUrlRef.current = activeTab.url;
    try {
      onUrlLoaded(new URL(activeTab.url).origin);
    } catch {
      onUrlLoaded(activeTab.url);
    }
  }, [activeTab?.url, activeTab?.loading, onUrlLoaded]);

  // 外部クリックでドロップダウンを閉じる
  useEffect(() => {
    if (!showUrlDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (urlBarRef.current && !urlBarRef.current.contains(e.target as Node)) {
        setShowUrlDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showUrlDropdown]);

  // --- タブ操作 ---
  const handleAddTab = useCallback(() => {
    window.storywright.createPreviewTab().catch(() => {});
    setBarUrl("");
  }, []);

  const handleCloseTab = useCallback((tabId: string) => {
    window.storywright.closePreviewTab(tabId).catch(() => {});
  }, []);

  const handleSwitchTab = useCallback((tabId: string) => {
    window.storywright.activatePreviewTab(tabId).catch(() => {});
  }, []);

  // --- ナビゲーション ---
  const handleGoBack = useCallback(() => {
    window.storywright.previewGoBack().catch(() => {});
  }, []);

  const handleGoForward = useCallback(() => {
    window.storywright.previewGoForward().catch(() => {});
  }, []);

  const handleReload = useCallback(() => {
    window.storywright.previewReload().catch(() => {});
  }, []);

  const handleUrlSubmit = useCallback(() => {
    setIsEditing(false);
    setShowUrlDropdown(false);
    if (!barUrl || !/^https?:\/\//.test(barUrl)) return;
    onUrlChange(barUrl);
    window.storywright.loadPreviewUrl(barUrl).catch(() => {});
  }, [barUrl, onUrlChange]);

  const handleUrlSelect = useCallback(
    (selectedUrl: string) => {
      setBarUrl(selectedUrl);
      setIsEditing(false);
      setShowUrlDropdown(false);
      onUrlChange(selectedUrl);
      window.storywright.loadPreviewUrl(selectedUrl).catch(() => {});
    },
    [onUrlChange],
  );

  return (
    <div className="preview-panel">
      {/* タブバー */}
      <div className="tab-bar">
        {previewState.tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab-bar-item ${tab.id === previewState.activeTabId ? "active" : ""}`}
            onClick={() => handleSwitchTab(tab.id)}
          >
            <span className="tab-bar-title" title={tab.title}>
              {tab.title}
            </span>
            <button
              className="tab-bar-close"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCloseTab(tab.id);
              }}
              title="タブを閉じる"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          className="tab-bar-add"
          type="button"
          onClick={handleAddTab}
          title="新しいタブ"
        >
          +
        </button>
      </div>

      {/* ブラウザバー */}
      <div className="browser-bar">
        <button
          className="browser-bar-btn"
          type="button"
          onClick={handleGoBack}
          disabled={!activeTab?.canGoBack || isRunning}
          title="戻る"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M12.5 15L7.5 10L12.5 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          className="browser-bar-btn"
          type="button"
          onClick={handleGoForward}
          disabled={!activeTab?.canGoForward || isRunning}
          title="進む"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M7.5 5L12.5 10L7.5 15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          className="browser-bar-btn"
          type="button"
          onClick={handleReload}
          disabled={!hasActiveUrl || isRunning}
          title="再読み込み"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M14.5 9A5.5 5.5 0 1 1 9 3.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M9 1L12 3.5L9 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="browser-bar-url-area" ref={urlBarRef}>
          <input
            className="browser-bar-url-input"
            value={barUrl}
            disabled={isRunning}
            onChange={(e) => {
              setBarUrl(e.target.value);
              setIsEditing(true);
              setShowUrlDropdown(true);
            }}
            onFocus={() => {
              setIsEditing(true);
              setShowUrlDropdown(true);
            }}
            onBlur={() => {
              setTimeout(() => setIsEditing(false), 200);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleUrlSubmit();
              if (e.key === "Escape") {
                setIsEditing(false);
                setShowUrlDropdown(false);
              }
            }}
            placeholder="https://example.com"
          />
          {showUrlDropdown && urlHistory.length > 0 && (
            <div className="url-dropdown">
              {urlHistory.map((u) => (
                <div key={u} className="url-dropdown-item">
                  <button
                    className="url-dropdown-label"
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleUrlSelect(u);
                    }}
                  >
                    {u}
                  </button>
                  <button
                    className="url-dropdown-delete"
                    type="button"
                    title="履歴から削除"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDeleteUrlHistory(u);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 録画バッジ */}
      {isRecording && (
        <div className="preview-recording-badge">
          ● 録画中 — {recordedStepCount} ステップ記録済み
        </div>
      )}

      <div className="webview-container" ref={previewContainerRef}>
        {!hasActiveUrl && (
          <div className="preview-empty">
            <p className="preview-empty-icon">🌐</p>
            <p className="preview-empty-text">
              上のアドレスバーにサイトの URL を入力してください
            </p>
            <p className="preview-empty-hint">例: https://example.com</p>
          </div>
        )}
      </div>
    </div>
  );
}
