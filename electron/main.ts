const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { chromium } = require("playwright");

let mainWindow: BrowserWindow | null = null;
let previewWindow: BrowserWindow | null = null;
let isRecording = false;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
    previewWindow?.close();
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

async function executeStep(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]>>,
  step: Step,
  baseUrl?: string,
): Promise<StepResult> {
  const start = Date.now();
  try {
    switch (step.action) {
      case "navigate":
        await page.goto(resolveUrl(step.target, baseUrl), {
          waitUntil: "domcontentloaded",
        });
        break;
      case "click":
        await page.locator(step.target).click({ timeout: 10000 });
        break;
      case "type":
        await page.locator(step.target).fill(step.value, { timeout: 10000 });
        break;
      case "select":
        await page.locator(step.target).selectOption(step.value, {
          timeout: 10000,
        });
        break;
      case "assert": {
        const el = page.locator(step.target);
        await el.waitFor({ timeout: 10000 });
        const text = await el.textContent();
        if (!text?.includes(step.value)) {
          throw new Error(
            `Assertion failed: expected "${step.value}" in "${text}"`,
          );
        }
        break;
      }
      case "wait":
        if (step.value === "hidden") {
          await page.locator(step.target).waitFor({
            state: "hidden",
            timeout: 10000,
          });
        } else {
          await page.locator(step.target).waitFor({
            state: "visible",
            timeout: 10000,
          });
        }
        break;
      case "screenshot":
        break;
      default:
        throw new Error(`Unknown action: ${step.action}`);
    }
    return { order: step.order, status: "passed", durationMs: Date.now() - start };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { order: step.order, status: "failed", durationMs: Date.now() - start, error: message };
  }
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

  function generateSelector(el) {
    // 1. data-testid
    if (el.dataset && el.dataset.testid) {
      return '[data-testid="' + el.dataset.testid + '"]';
    }
    // 2. role + accessible name
    var role = el.getAttribute('role') || el.tagName.toLowerCase();
    var ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) {
      return 'role=' + role + '[name="' + ariaLabel + '"]';
    }
    // 3. text content (buttons, links)
    if ((el.tagName === 'BUTTON' || el.tagName === 'A') && el.textContent) {
      var text = el.textContent.trim();
      if (text.length > 0 && text.length <= 50) {
        return 'text="' + text + '"';
      }
    }
    // 4. id
    if (el.id) {
      return '#' + el.id;
    }
    // 5. CSS selector fallback
    var parts = [];
    var current = el;
    while (current && current !== document.body && parts.length < 4) {
      var tag = current.tagName.toLowerCase();
      var classes = Array.from(current.classList).filter(function(c) {
        return !/^[0-9]/.test(c) && c.length < 30;
      }).slice(0, 2);
      if (classes.length > 0) {
        parts.unshift(tag + '.' + classes.join('.'));
      } else {
        parts.unshift(tag);
      }
      current = current.parentElement;
    }
    return parts.join(' > ');
  }

  function sendStep(data) {
    console.debug('__storywright_step__' + JSON.stringify(data));
  }

  // click capture
  document.addEventListener('click', function(e) {
    var target = e.target;
    if (!target || !target.tagName) return;
    sendStep({
      action: 'click',
      target: generateSelector(target),
      value: '',
      timestamp: Date.now()
    });
  }, true);

  // type capture (debounced per element)
  var inputTimers = new WeakMap();
  function handleInput(e) {
    var target = e.target;
    if (!target || !target.tagName) return;
    var tag = target.tagName.toLowerCase();
    if (tag !== 'input' && tag !== 'textarea' && !target.isContentEditable) return;

    if (inputTimers.has(target)) clearTimeout(inputTimers.get(target));
    inputTimers.set(target, setTimeout(function() {
      sendStep({
        action: 'type',
        target: generateSelector(target),
        value: target.value || target.textContent || '',
        timestamp: Date.now()
      });
      inputTimers.delete(target);
    }, 500));
  }
  document.addEventListener('input', handleInput, true);
})();
`;

function setupRecorderOnPreview() {
  if (!previewWindow || previewWindow.isDestroyed()) return;

  const wc = previewWindow.webContents;

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

  // click/type キャプチャ (console.debug 経由)
  wc.on("console-message", (_event, level, message) => {
    if (!isRecording) return;
    if (level === 2 && message.startsWith("__storywright_step__")) {
      try {
        const step = JSON.parse(message.replace("__storywright_step__", ""));
        mainWindow?.webContents.send("recorder:step", step);
      } catch {
        // パース失敗は無視
      }
    }
  });
}

function teardownRecorder() {
  if (!previewWindow || previewWindow.isDestroyed()) return;
  try {
    previewWindow.webContents.debugger.detach();
  } catch {
    // 既にデタッチ済み
  }
}

// === IPC Handlers ===

function registerIpcHandlers() {
  ipcMain.handle("open-preview", async (_event, url: string) => {
    if (previewWindow && !previewWindow.isDestroyed()) {
      previewWindow.loadURL(url);
      previewWindow.focus();
      return;
    }

    previewWindow = new BrowserWindow({
      width: 1024,
      height: 768,
      title: "Storywright Preview",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    previewWindow.loadURL(url);

    previewWindow.on("closed", () => {
      previewWindow = null;
    });
  });

  ipcMain.handle("close-preview", async () => {
    if (previewWindow && !previewWindow.isDestroyed()) {
      previewWindow.close();
      previewWindow = null;
    }
  });

  ipcMain.handle("start-recording", async (_event, url: string) => {
    // Preview ウィンドウを開く（または再利用）
    if (!previewWindow || previewWindow.isDestroyed()) {
      previewWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        title: "Storywright Preview — Recording",
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      previewWindow.on("closed", () => {
        if (isRecording) {
          isRecording = false;
          mainWindow?.webContents.send("recorder:stopped");
        }
        previewWindow = null;
      });
    }

    previewWindow.loadURL(url);
    isRecording = true;
    setupRecorderOnPreview();
  });

  ipcMain.handle("stop-recording", async () => {
    isRecording = false;
    teardownRecorder();
  });

  ipcMain.handle("run-story", async (_event, storyJson: string) => {
    const story: StoryInput = JSON.parse(storyJson);
    const browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const stepResults: StepResult[] = [];
    let storyStatus: "passed" | "failed" = "passed";

    for (const step of story.steps) {
      if (storyStatus === "failed") {
        stepResults.push({ order: step.order, status: "skipped", durationMs: 0 });
        continue;
      }
      const result = await executeStep(page, step, story.baseUrl);
      stepResults.push(result);
      if (result.status === "failed") {
        storyStatus = "failed";
      }
    }

    await browser.close();

    return {
      storyId: story.id,
      status: storyStatus,
      stepResults,
    };
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
