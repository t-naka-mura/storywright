import { useState, useRef, useEffect, useCallback } from "react";

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
  const hasUrl = url && /^https?:\/\//.test(url);
  const webviewRef = useRef<HTMLElement>(null);

  // ブラウザバーの URL 入力状態（編集中は webview と独立）
  const [barUrl, setBarUrl] = useState(url);
  const [isEditing, setIsEditing] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [showUrlDropdown, setShowUrlDropdown] = useState(false);
  const urlBarRef = useRef<HTMLDivElement>(null);

  // 外部から url が変わったらバーも更新（編集中でなければ）
  useEffect(() => {
    if (!isEditing) {
      setBarUrl(url);
    }
  }, [url, isEditing]);

  // webview のナビゲーション状態を更新
  const updateNavState = useCallback(() => {
    const wv = webviewRef.current as unknown as {
      canGoBack: () => boolean;
      canGoForward: () => boolean;
      getURL: () => string;
    } | null;
    if (!wv) return;
    setCanGoBack(wv.canGoBack());
    setCanGoForward(wv.canGoForward());
    const currentUrl = wv.getURL();
    if (currentUrl && /^https?:\/\//.test(currentUrl)) {
      setBarUrl(currentUrl);
    }
  }, []);

  const handleDidFinishLoad = useCallback(() => {
    updateNavState();
    if (!webviewRef.current || !onUrlLoaded) return;
    const wv = webviewRef.current as unknown as { getURL: () => string };
    const loadedUrl = wv.getURL();
    if (loadedUrl && /^https?:\/\//.test(loadedUrl)) {
      try {
        const origin = new URL(loadedUrl).origin;
        onUrlLoaded(origin);
      } catch {
        onUrlLoaded(loadedUrl);
      }
    }
  }, [onUrlLoaded, updateNavState]);

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;
    wv.addEventListener("did-finish-load", handleDidFinishLoad);
    wv.addEventListener("did-navigate", updateNavState);
    wv.addEventListener("did-navigate-in-page", updateNavState);
    return () => {
      wv.removeEventListener("did-finish-load", handleDidFinishLoad);
      wv.removeEventListener("did-navigate", updateNavState);
      wv.removeEventListener("did-navigate-in-page", updateNavState);
    };
  }, [handleDidFinishLoad, updateNavState]);

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

  // ナビゲーション操作
  const handleGoBack = useCallback(() => {
    const wv = webviewRef.current as unknown as { goBack: () => void } | null;
    wv?.goBack();
  }, []);

  const handleGoForward = useCallback(() => {
    const wv = webviewRef.current as unknown as { goForward: () => void } | null;
    wv?.goForward();
  }, []);

  const handleReload = useCallback(() => {
    const wv = webviewRef.current as unknown as { reload: () => void } | null;
    wv?.reload();
  }, []);

  // Enter で URL 遷移
  const handleUrlSubmit = useCallback(() => {
    setIsEditing(false);
    setShowUrlDropdown(false);
    if (!barUrl || !/^https?:\/\//.test(barUrl)) return;
    onUrlChange(barUrl);
    // 既に webview が表示中なら loadURL で直接遷移
    const wv = webviewRef.current as unknown as { loadURL: (url: string) => void } | null;
    if (wv && hasUrl) {
      wv.loadURL(barUrl);
    }
  }, [barUrl, onUrlChange, hasUrl]);

  const handleUrlSelect = useCallback((selectedUrl: string) => {
    setBarUrl(selectedUrl);
    setIsEditing(false);
    setShowUrlDropdown(false);
    onUrlChange(selectedUrl);
    const wv = webviewRef.current as unknown as { loadURL: (url: string) => void } | null;
    if (wv && hasUrl) {
      wv.loadURL(selectedUrl);
    }
  }, [onUrlChange, hasUrl]);

  return (
    <div className="preview-panel">
      {/* ブラウザバー */}
      <div className="browser-bar">
        <button
          className="browser-bar-btn"
          type="button"
          onClick={handleGoBack}
          disabled={!canGoBack || isRunning}
          title="戻る"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button
          className="browser-bar-btn"
          type="button"
          onClick={handleGoForward}
          disabled={!canGoForward || isRunning}
          title="進む"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button
          className="browser-bar-btn"
          type="button"
          onClick={handleReload}
          disabled={!hasUrl || isRunning}
          title="再読み込み"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M14.5 9A5.5 5.5 0 1 1 9 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M9 1L12 3.5L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
              // ドロップダウン選択のために少し遅延
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

      {/* webview or empty state */}
      {hasUrl ? (
        <webview
          ref={webviewRef as React.Ref<HTMLElement>}
          src={url}
          style={{ width: "100%", height: "100%" }}
          allowpopups
        />
      ) : (
        <div className="preview-empty">
          <p className="preview-empty-icon">🌐</p>
          <p className="preview-empty-text">
            上のアドレスバーにサイトの URL を入力してください
          </p>
          <p className="preview-empty-hint">
            例: https://example.com
          </p>
        </div>
      )}
    </div>
  );
}
