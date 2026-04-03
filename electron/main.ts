const { app, BrowserWindow, ipcMain, webContents, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");

// === データ永続化 ===

function getDataDir(): string {
  const dir = path.join(app.getPath("userData"), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function saveData(filename: string, data: unknown): void {
  const filePath = path.join(getDataDir(), filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function loadData<T>(filename: string, fallback: T): T {
  const filePath = path.join(getDataDir(), filename);
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

let mainWindow: BrowserWindow | null = null;
let isRecording = false;
let recordingWebContentsId: number | null = null;

function createMainWindow() {
  const iconPath = process.platform === "darwin"
    ? path.join(__dirname, "../build/icon.icns")
    : path.join(__dirname, "../build/icon.ico");
  const icon = nativeImage.createFromPath(iconPath);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    icon,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// === Helpers ===

function resolveUrl(target: string, baseUrl?: string): string {
  if (/^https?:\/\//.test(target)) return target;
  const base = baseUrl?.replace(/\/$/, "") ?? "";
  return base + (target.startsWith("/") ? target : "/" + target);
}

interface Step {
  order: number;
  action: string;
  target: string;
  value: string;
}

interface StoryInput {
  id: string;
  title: string;
  baseUrl?: string;
  steps: Step[];
}

interface StepResult {
  order: number;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  error?: string;
}


// === Recorder ===

/**
 * セレクタ生成 + イベントキャプチャ用のインジェクションスクリプト。
 * Preview ウィンドウ内で実行され、click / type / navigate をキャプチャして
 * console.debug 経由で main process に通知する。
 */
const RECORDER_INJECTION_SCRIPT = `
(function() {
  if (window.__storywrightRecorder) return;
  window.__storywrightRecorder = true;
  window.__storywrightAssertMode = false;

  // === セレクタ生成 ===

  function getLabelsFor(el) {
    // label[for=id] or ancestor label
    if (el.id) {
      var label = document.querySelector('label[for="' + el.id + '"]');
      if (label) return label.textContent.trim();
    }
    var parent = el.closest('label');
    if (parent) return parent.textContent.trim();
    return null;
  }

  function nthChildIndex(el) {
    var siblings = el.parentElement ? Array.from(el.parentElement.children) : [];
    var sameTag = siblings.filter(function(s) { return s.tagName === el.tagName; });
    if (sameTag.length <= 1) return '';
    return ':nth-child(' + (Array.from(el.parentElement.children).indexOf(el) + 1) + ')';
  }

  function generateSelector(el) {
    // 1. data-testid
    if (el.dataset && el.dataset.testid) {
      return '[data-testid="' + el.dataset.testid + '"]';
    }
    // 2. role + accessible name
    var ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) {
      var role = el.getAttribute('role') || el.tagName.toLowerCase();
      return 'role=' + role + '[name="' + ariaLabel + '"]';
    }
    // 3. label text (for input/select/textarea)
    var tag = el.tagName.toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') {
      var labelText = getLabelsFor(el);
      if (labelText && labelText.length <= 50) {
        return 'label:has-text("' + labelText + '") >> ' + tag;
      }
    }
    // 4. placeholder
    if (el.placeholder && el.placeholder.length <= 50) {
      return '[placeholder="' + el.placeholder + '"]';
    }
    // 5. text content (buttons, links)
    if ((el.tagName === 'BUTTON' || el.tagName === 'A') && el.textContent) {
      var text = el.textContent.trim();
      if (text.length > 0 && text.length <= 50) {
        return 'text="' + text + '"';
      }
    }
    // 6. id
    if (el.id) {
      return '#' + el.id;
    }
    // 7. CSS selector fallback (improved)
    var parts = [];
    var current = el;
    while (current && current !== document.body && parts.length < 4) {
      var ctag = current.tagName.toLowerCase();
      var segment = ctag;
      // type attribute for inputs
      var typeAttr = current.getAttribute('type');
      if (ctag === 'input' && typeAttr) {
        segment = ctag + '[type="' + typeAttr + '"]';
      }
      var classes = Array.from(current.classList).filter(function(c) {
        return !/^[0-9]/.test(c) && c.length < 30;
      }).slice(0, 2);
      if (classes.length > 0) {
        segment = ctag + '.' + classes.join('.');
      }
      segment += nthChildIndex(current);
      parts.unshift(segment);
      current = current.parentElement;
    }
    return parts.join(' > ');
  }

  function sendStep(data) {
    console.debug('__storywright_step__' + JSON.stringify(data));
  }

  // === アサートモード ===

  var highlightedEl = null;
  var originalOutline = '';

  function clearHighlight() {
    if (highlightedEl) {
      highlightedEl.style.outline = originalOutline;
      highlightedEl = null;
      originalOutline = '';
    }
  }

  function handleAssertMouseover(e) {
    if (!window.__storywrightAssertMode) return;
    var target = e.target;
    if (!target || !target.tagName || target === highlightedEl) return;
    clearHighlight();
    highlightedEl = target;
    originalOutline = target.style.outline;
    target.style.outline = '2px solid #5b7bd7';
  }

  function handleAssertMouseout(e) {
    if (!window.__storywrightAssertMode) return;
    if (e.target === highlightedEl) {
      clearHighlight();
    }
  }

  function handleAssertClick(e) {
    if (!window.__storywrightAssertMode) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    var target = e.target;
    if (!target || !target.tagName) return;

    var textContent = (target.textContent || '').trim();
    sendStep({
      action: 'assert',
      target: generateSelector(target),
      value: textContent,
      timestamp: Date.now()
    });

    // アサートモード解除
    clearHighlight();
    window.__storywrightAssertMode = false;
    console.debug('__storywright_assert_done__');
  }

  document.addEventListener('mouseover', handleAssertMouseover, true);
  document.addEventListener('mouseout', handleAssertMouseout, true);
  document.addEventListener('click', handleAssertClick, true);

  // アサートモード切替用のグローバル関数
  window.__storywrightSetAssertMode = function(enabled) {
    window.__storywrightAssertMode = enabled;
    if (!enabled) clearHighlight();
  };

  // === 通常の録画キャプチャ ===

  // click capture (アサートモードでない時のみ)
  document.addEventListener('click', function(e) {
    if (window.__storywrightAssertMode) return;
    var target = e.target;
    if (!target || !target.tagName) return;
    sendStep({
      action: 'click',
      target: generateSelector(target),
      value: '',
      timestamp: Date.now()
    });
  }, false);

  // type capture: フォーカスアウト時に確定値を送信（シンプル・確実）
  var lastSentValues = new WeakMap();

  function captureInputValue(target) {
    if (!target || !target.tagName) return;
    var tag = target.tagName.toLowerCase();
    if (tag !== 'input' && tag !== 'textarea' && !target.isContentEditable) return;
    var value = target.value || target.textContent || '';
    if (!value) return;
    // 同じ要素・同じ値なら送信しない
    if (lastSentValues.get(target) === value) return;
    lastSentValues.set(target, value);
    sendStep({
      action: 'type',
      target: generateSelector(target),
      value: value,
      timestamp: Date.now()
    });
  }

  // blur: フォーカスが外れた時に確定値を送信
  document.addEventListener('blur', function(e) {
    if (window.__storywrightAssertMode) return;
    captureInputValue(e.target);
  }, true);

  // change: フォームリセットや autocomplete 対応
  document.addEventListener('change', function(e) {
    if (window.__storywrightAssertMode) return;
    var target = e.target;
    if (target && target.tagName === 'SELECT') return; // SELECT は別ハンドラ
    captureInputValue(target);
  }, true);

  // keydown Enter: フォーム送信前にキャプチャ（blur が発火しないケース対応）
  document.addEventListener('keydown', function(e) {
    if (window.__storywrightAssertMode) return;
    if (e.key !== 'Enter') return;
    captureInputValue(e.target);
  }, true);

  // select capture (change イベントのうち SELECT 要素のみ)
  document.addEventListener('change', function(e) {
    if (window.__storywrightAssertMode) return;
    var target = e.target;
    if (!target || target.tagName !== 'SELECT') return;
    sendStep({
      action: 'select',
      target: generateSelector(target),
      value: target.value,
      timestamp: Date.now()
    });
  }, false);
})();
`;

function findWebviewContents(): Electron.WebContents | null {
  const all = webContents.getAllWebContents();
  return all.find((wc: Electron.WebContents) => wc.getType() === "webview") ?? null;
}

function setupRecorderOnWebview(wc: Electron.WebContents) {
  recordingWebContentsId = wc.id;

  // CDP 接続してインジェクションスクリプトを自動注入
  try {
    wc.debugger.attach("1.3");
  } catch {
    // 既にアタッチ済みの場合は無視
  }

  // ページ遷移後も自動でスクリプトを再注入
  wc.debugger.sendCommand("Page.enable");
  wc.debugger.sendCommand("Page.addScriptToEvaluateOnNewDocument", {
    source: RECORDER_INJECTION_SCRIPT,
  });

  // 現在のページにも注入
  wc.executeJavaScript(RECORDER_INJECTION_SCRIPT).catch(() => {});

  // ドメイン跨ぎナビゲーション時にスクリプトを再注入
  wc.on("did-navigate", () => {
    if (!isRecording) return;
    wc.executeJavaScript(RECORDER_INJECTION_SCRIPT).catch(() => {});
  });

  // navigate キャプチャ (CDP の Page.frameNavigated)
  wc.debugger.on("message", (_event, method, params) => {
    if (!isRecording) return;
    if (method === "Page.frameNavigated" && params.frame && !params.frame.parentId) {
      mainWindow?.webContents.send("recorder:step", {
        action: "navigate",
        target: params.frame.url,
        value: "",
        timestamp: Date.now(),
      });
    }
  });

  // click/type/select/assert キャプチャ (console.debug 経由)
  // console.debug = level 0 (verbose) in Electron
  wc.on("console-message", (_event, _level, message) => {
    if (!isRecording) return;
    if (message.startsWith("__storywright_step__")) {
      try {
        const step = JSON.parse(message.replace("__storywright_step__", ""));
        mainWindow?.webContents.send("recorder:step", step);
      } catch {
        // パース失敗は無視
      }
    }
    if (message === "__storywright_assert_done__") {
      mainWindow?.webContents.send("recorder:assert-done");
    }
  });
}

function teardownRecorder() {
  if (recordingWebContentsId === null) return;
  try {
    const wc = webContents.fromId(recordingWebContentsId);
    if (wc && !wc.isDestroyed()) {
      wc.debugger.detach();
    }
  } catch {
    // 既にデタッチ済み
  }
  recordingWebContentsId = null;
}

// === IPC Handlers ===

function registerIpcHandlers() {
  // データ永続化
  ipcMain.handle("save-data", async (_event, filename: string, data: unknown) => {
    saveData(filename, data);
  });

  ipcMain.handle("load-data", async (_event, filename: string) => {
    return loadData(filename, null);
  });

  ipcMain.handle("start-recording", async () => {
    const wc = findWebviewContents();
    if (!wc) {
      throw new Error("Preview が見つかりません。Preview タブを開いてください。");
    }
    isRecording = true;
    setupRecorderOnWebview(wc);
  });

  ipcMain.handle("stop-recording", async () => {
    isRecording = false;
    teardownRecorder();
  });

  ipcMain.handle("toggle-assert-mode", async (_event, enabled: boolean) => {
    if (recordingWebContentsId === null) return;
    const wc = webContents.fromId(recordingWebContentsId);
    if (!wc || wc.isDestroyed()) return;
    wc.executeJavaScript(`window.__storywrightSetAssertMode(${enabled})`)
      .catch(() => {});
  });

  // === Webview 上でのステップ実行 ===

  /**
   * セレクタ解決 + アクション実行スクリプト。
   * レコーダーが生成する全パターンをカバーする。
   */
  const EXECUTOR_INJECTION_SCRIPT = `
(function() {
  if (window.__storywrightExecutor) return;
  window.__storywrightExecutor = true;

  function resolveSelector(selector) {
    // text="..." — テキスト内容で検索
    var textMatch = selector.match(/^text="(.+)"$/);
    if (textMatch) {
      var text = textMatch[1];
      var candidates = document.querySelectorAll('button, a, [role="button"], [role="link"]');
      for (var i = 0; i < candidates.length; i++) {
        if (candidates[i].textContent && candidates[i].textContent.trim() === text) {
          return candidates[i];
        }
      }
      // フォールバック: 全要素から検索
      var all = document.querySelectorAll('*');
      for (var j = 0; j < all.length; j++) {
        if (all[j].childElementCount === 0 && all[j].textContent && all[j].textContent.trim() === text) {
          return all[j];
        }
      }
      return null;
    }

    // role=...[name="..."] — ARIA ロール + 名前で検索
    var roleMatch = selector.match(/^role=([\\w]+)\\[name="(.+)"\\]$/);
    if (roleMatch) {
      var role = roleMatch[1];
      var name = roleMatch[2];
      var roleEls = document.querySelectorAll('[role="' + role + '"], ' + role);
      for (var k = 0; k < roleEls.length; k++) {
        var ariaLabel = roleEls[k].getAttribute('aria-label') || roleEls[k].textContent?.trim();
        if (ariaLabel === name) return roleEls[k];
      }
      return null;
    }

    // label:has-text("...") >> tag — ラベルテキストから子要素を検索
    var labelMatch = selector.match(/^label:has-text\\("(.+)"\\) >> (\\w+)$/);
    if (labelMatch) {
      var labelText = labelMatch[1];
      var childTag = labelMatch[2];
      var labels = document.querySelectorAll('label');
      for (var l = 0; l < labels.length; l++) {
        if (labels[l].textContent && labels[l].textContent.includes(labelText)) {
          // label 内の子要素
          var child = labels[l].querySelector(childTag);
          if (child) return child;
          // label[for] で関連付けられた要素
          var forId = labels[l].getAttribute('for');
          if (forId) {
            var target = document.getElementById(forId);
            if (target && target.tagName.toLowerCase() === childTag) return target;
          }
        }
      }
      return null;
    }

    // CSS セレクタ（#id, [data-testid="..."], [placeholder="..."], etc.）
    try {
      return document.querySelector(selector);
    } catch(e) {
      return null;
    }
  }

  function waitForElement(selector, timeoutMs) {
    return new Promise(function(resolve, reject) {
      var el = resolveSelector(selector);
      if (el) { resolve(el); return; }
      var elapsed = 0;
      var interval = setInterval(function() {
        elapsed += 100;
        el = resolveSelector(selector);
        if (el) { clearInterval(interval); resolve(el); return; }
        if (elapsed >= timeoutMs) { clearInterval(interval); reject(new Error('Element not found: ' + selector)); }
      }, 100);
    });
  }

  window.__storywrightExecuteStep = async function(step) {
    var timeout = 10000;

    switch (step.action) {
      case 'click': {
        var el = await waitForElement(step.target, timeout);
        el.scrollIntoView({ block: 'center' });
        el.click();
        return { status: 'passed' };
      }
      case 'type': {
        var input = await waitForElement(step.target, timeout);
        input.scrollIntoView({ block: 'center' });
        input.focus();
        // 既存値をクリアしてから入力
        var nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value'
        )?.set || Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        )?.set;
        if (nativeSetter) {
          nativeSetter.call(input, step.value);
        } else {
          input.value = step.value;
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return { status: 'passed' };
      }
      case 'select': {
        var sel = await waitForElement(step.target, timeout);
        sel.scrollIntoView({ block: 'center' });
        sel.value = step.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return { status: 'passed' };
      }
      case 'assert': {
        var assertEl = await waitForElement(step.target, timeout);
        var text = assertEl.textContent || '';
        if (!text.includes(step.value)) {
          throw new Error('Assertion failed: expected "' + step.value + '" in "' + text.trim() + '"');
        }
        return { status: 'passed' };
      }
      case 'wait': {
        if (step.value === 'hidden') {
          // 要素が非表示になるまで待つ
          await new Promise(function(resolve, reject) {
            var elapsed = 0;
            var interval = setInterval(function() {
              elapsed += 100;
              var el = resolveSelector(step.target);
              if (!el || el.offsetParent === null) { clearInterval(interval); resolve(); return; }
              if (elapsed >= timeout) { clearInterval(interval); reject(new Error('Element still visible: ' + step.target)); }
            }, 100);
          });
        } else {
          await waitForElement(step.target, timeout);
        }
        return { status: 'passed' };
      }
      case 'screenshot':
        return { status: 'passed' };
      default:
        throw new Error('Unknown action: ' + step.action);
    }
  };
})();
`;

  const SLOW_MO = 300; // ステップ間の待機時間(ms) — 操作の様子を見やすくする
  let currentRunId = 0;

  async function runStoryOnWebview(story: StoryInput, keepSession: boolean, runId: number): Promise<{
    storyId: string;
    status: "passed" | "failed";
    stepResults: StepResult[];
  }> {
    const wc = findWebviewContents();
    if (!wc) {
      throw new Error("Preview が見つかりません。Preview タブを開いてください。");
    }

    // セッションクリア
    if (!keepSession) {
      await wc.session.clearStorageData();
      await wc.session.clearCache();
    }

    // 実行エンジンを注入
    await wc.executeJavaScript(EXECUTOR_INJECTION_SCRIPT);

    const stepResults: StepResult[] = [];
    let storyStatus: "passed" | "failed" = "passed";

    for (const step of story.steps) {
      if (runId !== currentRunId) {
        stepResults.push({ order: step.order, status: "skipped", durationMs: 0 });
        continue;
      }
      if (storyStatus === "failed") {
        stepResults.push({ order: step.order, status: "skipped", durationMs: 0 });
        mainWindow?.webContents.send("step:progress", {
          storyId: story.id,
          order: step.order,
          status: "skipped",
          durationMs: 0,
        });
        continue;
      }

      // ステップ開始通知
      mainWindow?.webContents.send("step:progress", {
        storyId: story.id,
        order: step.order,
        status: "running",
        durationMs: 0,
      });

      const start = Date.now();
      try {
        if (step.action === "navigate") {
          const url = resolveUrl(step.target, story.baseUrl);
          await wc.loadURL(url);
          // ロード後に実行エンジンを再注入
          await wc.executeJavaScript(EXECUTOR_INJECTION_SCRIPT);
        } else {
          const result = await wc.executeJavaScript(
            `window.__storywrightExecuteStep(${JSON.stringify(step)})`,
          );
          if (!result || result.status !== "passed") {
            throw new Error(result?.error || "Step failed");
          }
        }
        const durationMs = Date.now() - start;
        stepResults.push({ order: step.order, status: "passed", durationMs });
        mainWindow?.webContents.send("step:progress", {
          storyId: story.id,
          order: step.order,
          status: "passed",
          durationMs,
        });
      } catch (err: unknown) {
        const durationMs = Date.now() - start;
        const message = err instanceof Error ? err.message : String(err);
        stepResults.push({ order: step.order, status: "failed", durationMs, error: message });
        mainWindow?.webContents.send("step:progress", {
          storyId: story.id,
          order: step.order,
          status: "failed",
          durationMs,
          error: message,
        });
        storyStatus = "failed";
      }

      // slowMo: 操作の様子を見やすくする
      if (storyStatus !== "failed") {
        await new Promise((r) => setTimeout(r, SLOW_MO));
      }
    }

    return { storyId: story.id, status: storyStatus, stepResults };
  }

  ipcMain.handle("run-story", async (_event, storyJson: string, keepSession?: boolean) => {
    const story: StoryInput = JSON.parse(storyJson);
    const runId = ++currentRunId;
    return runStoryOnWebview(story, keepSession ?? false, runId);
  });

  ipcMain.handle("cancel-run", async () => {
    currentRunId++;
  });

  // === 繰り返し実行 ===

  let repeatCancelled = false;

  ipcMain.handle("run-story-repeat", async (_event, storyJson: string, repeatCount: number, keepSession?: boolean) => {
    const story: StoryInput = JSON.parse(storyJson);
    repeatCancelled = false;

    const iterations: Array<{ storyId: string; status: "passed" | "failed"; stepResults: StepResult[] }> = [];
    let passedIterations = 0;
    let failedIterations = 0;

    for (let i = 0; i < repeatCount; i++) {
      if (repeatCancelled) break;

      const runId = ++currentRunId;
      const iterResult = await runStoryOnWebview(story, keepSession ?? false, runId);
      iterations.push(iterResult);

      if (iterResult.status === "passed") passedIterations++;
      else failedIterations++;

      // 進捗を renderer に通知
      mainWindow?.webContents.send("repeat:progress", {
        current: i + 1,
        total: repeatCount,
        lastResult: iterResult,
      });
    }

    return {
      storyId: story.id,
      totalIterations: repeatCount,
      completedIterations: iterations.length,
      passedIterations,
      failedIterations,
      iterations,
    };
  });

  ipcMain.handle("cancel-repeat", async () => {
    repeatCancelled = true;
  });
}

// === App Lifecycle ===

app.whenReady().then(() => {
  registerIpcHandlers();
  createMainWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
