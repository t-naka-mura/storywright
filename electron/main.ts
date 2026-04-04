import { resolveStoryEnvironmentVariables } from "./resolveEnvPlaceholders";
import { prepareStoriesForPersistence, hydrateStoriesWithSecrets } from "./storySecrets";
import { inspectEnvironmentSource, normalizeEnvironmentSettings, resolveEnvironmentWithSettings } from "./environmentConfig";

const { app, BrowserWindow, ipcMain, webContents, nativeImage, safeStorage, WebContentsView, Menu, dialog } = require("electron");
const { parse: parseDotenv } = require("dotenv");
const path = require("path");
const fs = require("fs");

const STORIES_FILENAME = "stories.json";
const STORY_SECRETS_FILENAME = "storySecrets.json";
const LOCAL_STATE_FILENAMES = {
  urlHistory: "urlHistory.json",
  environment: "environment.json",
} as const;

type EnvironmentSettings = {
  domains?: Array<{
    id: string;
    name: string;
    values: Array<{ key: string; value: string }>;
  }>;
  activeDomainId?: string;
};

// === データ永続化 ===

function getDataDir(): string {
  const dir = path.join(app.getPath("userData"), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// === Sensitive 値の暗号化/復号 ===

function encryptValue(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) return value;
  const encrypted = safeStorage.encryptString(value);
  return "enc:" + encrypted.toString("base64");
}

function decryptValue(value: string): string {
  if (!value.startsWith("enc:")) return value;
  if (!safeStorage.isEncryptionAvailable()) return value;
  const buffer = Buffer.from(value.slice(4), "base64");
  return safeStorage.decryptString(buffer);
}

function mapSensitiveStepsInRecord(
  record: Record<string, { steps?: Array<{ sensitive?: boolean; value?: string }> }>,
  transform: (value: string) => string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, story] of Object.entries(record)) {
    if (!story || !Array.isArray(story.steps)) {
      result[key] = story;
      continue;
    }
    result[key] = {
      ...story,
      steps: story.steps.map((step) =>
        step.sensitive && step.value
          ? { ...step, value: transform(step.value) }
          : step
      ),
    };
  }
  return result;
}

function encryptSensitiveSteps(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  if ("stories" in data && data.stories && typeof data.stories === "object") {
    return {
      ...data,
      stories: mapSensitiveStepsInRecord(
        data.stories as Record<string, { steps?: Array<{ sensitive?: boolean; value?: string }> }>,
        encryptValue,
      ),
    };
  }
  return mapSensitiveStepsInRecord(
    data as Record<string, { steps?: Array<{ sensitive?: boolean; value?: string }> }>,
    encryptValue,
  );
}

function decryptSensitiveSteps(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  if ("stories" in data && data.stories && typeof data.stories === "object") {
    return {
      ...data,
      stories: mapSensitiveStepsInRecord(
        data.stories as Record<string, { steps?: Array<{ sensitive?: boolean; value?: string }> }>,
        decryptValue,
      ),
    };
  }
  return mapSensitiveStepsInRecord(
    data as Record<string, { steps?: Array<{ sensitive?: boolean; value?: string }> }>,
    decryptValue,
  );
}

function saveFile(filename: string, data: unknown): void {
  const filePath = path.join(getDataDir(), filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function loadFile<T>(filename: string, fallback: T): T {
  const filePath = path.join(getDataDir(), filename);
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function saveStories(data: unknown): void {
  const { stories, secrets } = prepareStoriesForPersistence(data);
  const encryptedSecrets = Object.fromEntries(
    Object.entries(secrets).map(([key, value]) => [key, encryptValue(value)]),
  );

  saveFile(STORIES_FILENAME, stories);
  saveFile(STORY_SECRETS_FILENAME, encryptedSecrets);
}

function loadStories<T>(fallback: T): T {
  const rawStories = loadFile(STORIES_FILENAME, fallback);
  const decryptedStories = decryptSensitiveSteps(rawStories);
  const rawSecrets = loadFile<Record<string, string>>(STORY_SECRETS_FILENAME, {});
  const decryptedSecrets = Object.fromEntries(
    Object.entries(rawSecrets).map(([key, value]) => [key, decryptValue(value)]),
  );
  return hydrateStoriesWithSecrets(decryptedStories, decryptedSecrets) as T;
}

function getPortableExportFilename(suggestedFileName?: string): string {
  if (suggestedFileName && suggestedFileName.trim().length > 0) {
    return suggestedFileName;
  }
  return "storywright-export.storywright.json";
}

function saveLocalState(key: keyof typeof LOCAL_STATE_FILENAMES, data: unknown): void {
  saveFile(LOCAL_STATE_FILENAMES[key], data);
}

function loadLocalState<T>(key: keyof typeof LOCAL_STATE_FILENAMES, fallback: T): T {
  return loadFile(LOCAL_STATE_FILENAMES[key], fallback);
}

function loadEnvironmentSettings(): EnvironmentSettings {
  return normalizeEnvironmentSettings(loadLocalState<EnvironmentSettings>("environment", {}));
}

function getResolvedEnvironment(): NodeJS.ProcessEnv {
  return resolveEnvironmentWithSettings(process.env, loadEnvironmentSettings());
}

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let isRecording = false;
let recordingWebContentsIds: number[] = [];
let previewTabIdCounter = 0;
let activePreviewTabId: string | null = null;
let previewBounds = { x: 0, y: 0, width: 0, height: 0 };

function loadWindowContents(targetWindow: Electron.BrowserWindow, hash = "") {
  if (process.env.VITE_DEV_SERVER_URL) {
    targetWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}${hash}`);
    return;
  }

  targetWindow.loadFile(path.join(__dirname, "../dist/index.html"), {
    hash: hash.replace(/^#/, ""),
  });
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();
}

function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (settingsWindow.isMinimized()) {
      settingsWindow.restore();
    }
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 920,
    height: 760,
    minWidth: 760,
    minHeight: 560,
    title: "Settings - Storywright",
    parent: mainWindow ?? undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  loadWindowContents(settingsWindow, "#/settings");
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

function buildApplicationMenu() {
  const isMac = process.platform === "darwin";
  const settingsItem = {
    label: "Settings...",
    accelerator: "CmdOrCtrl+,",
    click: () => openSettingsWindow(),
  };

  const template = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: "about" },
            { type: "separator" },
            settingsItem,
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        }]
      : []),
    {
      label: "File",
      submenu: [
        ...(!isMac ? [settingsItem] : []),
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Main Window", accelerator: "CmdOrCtrl+1", click: () => focusMainWindow() },
        { label: "Settings", accelerator: "CmdOrCtrl+2", click: () => openSettingsWindow() },
        { type: "separator" },
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac ? [{ type: "separator" }, { role: "front" }] : [{ role: "close" }]),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

interface PreviewTab {
  id: string;
  view: Electron.WebContentsView;
  title: string;
  url: string;
  loading: boolean;
  isClosing: boolean;
}

const previewTabs: PreviewTab[] = [];

function nextPreviewTabId(): string {
  return `preview-tab-${++previewTabIdCounter}`;
}

function getActivePreviewTab(): PreviewTab | null {
  return previewTabs.find((tab) => tab.id === activePreviewTabId) ?? null;
}

function getAllPreviewContents(): Electron.WebContents[] {
  return previewTabs
    .map((tab) => tab.view.webContents)
    .filter((wc) => !wc.isDestroyed());
}

function getActivePreviewContents(): Electron.WebContents | null {
  return getActivePreviewTab()?.view.webContents ?? null;
}

function canNavigateBack(wc: Electron.WebContents): boolean {
  if (typeof wc.navigationHistory?.canGoBack === "function") {
    return wc.navigationHistory.canGoBack();
  }
  return wc.canGoBack();
}

function canNavigateForward(wc: Electron.WebContents): boolean {
  if (typeof wc.navigationHistory?.canGoForward === "function") {
    return wc.navigationHistory.canGoForward();
  }
  return wc.canGoForward();
}

function navigateBack(wc: Electron.WebContents): void {
  if (typeof wc.navigationHistory?.goBack === "function") {
    wc.navigationHistory.goBack();
    return;
  }
  wc.goBack();
}

function navigateForward(wc: Electron.WebContents): void {
  if (typeof wc.navigationHistory?.goForward === "function") {
    wc.navigationHistory.goForward();
    return;
  }
  wc.goForward();
}

function getPreviewState() {
  return {
    tabs: previewTabs.map((tab) => {
      const wc = tab.view.webContents;
      return {
        id: tab.id,
        title: tab.title,
        url: tab.url,
        loading: tab.loading,
        canGoBack: !wc.isDestroyed() ? canNavigateBack(wc) : false,
        canGoForward: !wc.isDestroyed() ? canNavigateForward(wc) : false,
      };
    }),
    activeTabId: activePreviewTabId,
  };
}

function sendPreviewState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.webContents.isDestroyed()) return;
  if (mainWindow.webContents.isLoadingMainFrame()) return;
  try {
    mainWindow.webContents.send("preview:state", getPreviewState());
  } catch {
    // ignore renderer reload / disposal races
  }
}

function canMutateMainContentView() {
  return !!mainWindow && !mainWindow.isDestroyed();
}

function syncPreviewViews() {
  if (!canMutateMainContentView()) return;
  for (const tab of previewTabs) {
    if (!mainWindow.contentView.children.includes(tab.view)) {
      mainWindow.contentView.addChildView(tab.view);
    }
    tab.view.setBounds(previewBounds);
    tab.view.setVisible(
      tab.id === activePreviewTabId &&
        previewBounds.width > 0 &&
        previewBounds.height > 0,
    );
  }

  const activeTab = getActivePreviewTab();
  if (activeTab) {
    mainWindow.contentView.addChildView(activeTab.view);
  }
}

function updatePreviewTabState(tab: PreviewTab) {
  const wc = tab.view.webContents;
  if (wc.isDestroyed()) return;
  const currentUrl = wc.getURL();

  if (currentUrl && currentUrl !== "about:blank") {
    tab.url = currentUrl;
  }

  tab.title =
    wc.getTitle() ||
    (tab.loading ? "読み込み中..." : tab.url ? tab.url : "新しいタブ");
  syncPreviewViews();
  sendPreviewState();
}

function closePreviewTab(tabId: string, closeContents = true) {
  const index = previewTabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) return;

  const [tab] = previewTabs.splice(index, 1);
  tab.isClosing = true;

  if (canMutateMainContentView()) {
    try {
      mainWindow.contentView.removeChildView(tab.view);
    } catch {
      // ignore detached or destroyed view teardown
    }
  }

  if (closeContents && !tab.view.webContents.isDestroyed()) {
    try {
      tab.view.webContents.close();
    } catch {
      // ignore
    }
  }

  if (activePreviewTabId === tabId) {
    const fallback = previewTabs[index] ?? previewTabs[index - 1] ?? null;
    activePreviewTabId = fallback?.id ?? null;
  }

  if (previewTabs.length === 0) {
    createPreviewTab();
    return;
  }

  syncPreviewViews();
  sendPreviewState();
}

function setupNewWindowHandler(wc: Electron.WebContents) {
  wc.setWindowOpenHandler((details) => {
    return {
      action: "allow",
      createWindow: (options: { webContents?: Electron.WebContents; webPreferences?: Electron.WebPreferences }) => {
        const popupView = createPreviewView(options.webContents, options.webPreferences);
        const activate = details.disposition !== "background-tab";
        const tab = registerPreviewTab(popupView, activate, details.url, "読み込み中...");

        if (details.disposition === "background-tab") {
          popupView.webContents.loadURL(details.url).catch(() => {});
        }

        if (details.url) {
          setTimeout(() => {
            const popupContents = popupView.webContents;
            if (popupContents.isDestroyed() || tab.isClosing) return;
            const currentUrl = popupContents.getURL();
            const shouldKickNavigation = !currentUrl || currentUrl === "about:blank";
            if (!shouldKickNavigation) return;
            tab.loading = true;
            popupContents.loadURL(details.url).catch(() => {});
          }, 250);
        }

        if (isRecording) {
          setupRecorderOnWebview(tab.view.webContents);
        }

        return popupView.webContents;
      },
    };
  });
}

function createPreviewView(
  existingWebContents?: Electron.WebContents,
  webPreferences?: Electron.WebPreferences,
): Electron.WebContentsView {
  const view = existingWebContents
    ? new WebContentsView({ webContents: existingWebContents })
    : new WebContentsView({
        webPreferences: {
          ...(webPreferences ?? {}),
          backgroundThrottling: false,
        },
      });
  view.setBackgroundColor("#00000000");
  return view;
}

function registerPreviewTab(
  view: Electron.WebContentsView,
  activate = true,
  initialUrl = "",
  initialTitle = "新しいタブ",
): PreviewTab {
  const tab: PreviewTab = {
    id: nextPreviewTabId(),
    view,
    title: initialTitle,
    url: initialUrl,
    loading: false,
    isClosing: false,
  };

  const wc = view.webContents;
  const refresh = () => updatePreviewTabState(tab);
  const reconcileLoading = () => {
    if (wc.isDestroyed() || tab.isClosing) return;
    tab.loading = typeof wc.isLoadingMainFrame === "function"
      ? wc.isLoadingMainFrame()
      : wc.isLoading();
    refresh();
  };
  const finishLoading = () => {
    tab.loading = false;
    refresh();
  };

  wc.on("page-title-updated", refresh);
  wc.on("did-start-loading", () => {
    tab.loading = true;
    refresh();
  });
  wc.on("did-stop-loading", finishLoading);
  wc.on("did-finish-load", finishLoading);
  wc.on("did-fail-load", finishLoading);
  wc.on("did-fail-provisional-load", finishLoading);
  wc.on("did-navigate", refresh);
  wc.on("did-navigate-in-page", refresh);
  wc.on("destroyed", () => {
    if (!tab.isClosing) {
      closePreviewTab(tab.id, false);
    }
  });

  setupNewWindowHandler(wc);
  previewTabs.push(tab);

  if (activate || !activePreviewTabId) {
    activePreviewTabId = tab.id;
  }

  updatePreviewTabState(tab);
  for (const delay of [0, 100, 500, 1500]) {
    setTimeout(reconcileLoading, delay);
  }
  return tab;
}

function createPreviewTab(url = "", activate = true): PreviewTab {
  const view = createPreviewView();
  const tab = registerPreviewTab(view, activate, url, url ? "読み込み中..." : "新しいタブ");
  if (url) {
    view.webContents.loadURL(url).catch(() => {});
  }
  return tab;
}

function destroyPreviewTabs() {
  while (previewTabs.length > 0) {
    const tab = previewTabs.pop();
    if (!tab) continue;
    tab.isClosing = true;
    if (canMutateMainContentView()) {
      try {
        mainWindow.contentView.removeChildView(tab.view);
      } catch {
        // ignore detached or destroyed view teardown
      }
    }
    if (!tab.view.webContents.isDestroyed()) {
      try {
        tab.view.webContents.close();
      } catch {
        // ignore
      }
    }
  }
  activePreviewTabId = null;
}

function createMainWindow() {
  const iconPath = path.join(__dirname, "../build/icon.png");
  const icon = nativeImage.createFromPath(iconPath);

  // macOS: Dock アイコンを設定（dev モードでも反映されるように）
  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(icon);
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    title: "Storywright",
    icon,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  loadWindowContents(mainWindow);

  mainWindow.on("closed", () => {
    destroyPreviewTabs();
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close();
    }
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
  sensitive?: boolean;
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
    var stepData = {
      action: 'type',
      target: generateSelector(target),
      value: value,
      timestamp: Date.now()
    };
    // input[type="password"] は自動的に sensitive とする
    if (tag === 'input' && target.type === 'password') {
      stepData.sensitive = true;
    }
    sendStep(stepData);
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

function setupRecorderOnWebview(wc: Electron.WebContents) {
  if (recordingWebContentsIds.includes(wc.id)) return;
  recordingWebContentsIds.push(wc.id);

  // 新ウィンドウハンドラも確実にセット
  setupNewWindowHandler(wc);

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
  // Electron 35+: console-message は Event オブジェクト形式
  wc.on("console-message", (event: { message: string; level: number }) => {
    if (!isRecording) return;
    const message = event.message;
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
  for (const id of recordingWebContentsIds) {
    try {
      const wc = webContents.fromId(id);
      if (wc && !wc.isDestroyed()) {
        wc.debugger.detach();
      }
    } catch {
      // 既にデタッチ済み
    }
  }
  recordingWebContentsIds = [];
}

// === IPC Handlers ===

function registerIpcHandlers() {
  ipcMain.handle("app:open-settings", async () => {
    openSettingsWindow();
  });

  ipcMain.handle("environment:import-file", async () => {
    const targetWindow = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : mainWindow;
    const result = await dialog.showOpenDialog(targetWindow ?? undefined, {
      properties: ["openFile"],
      filters: [
        { name: "Environment Files", extensions: ["env", "local", "development", "production", "test"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    let fileContent: string;
    try {
      fileContent = fs.readFileSync(filePath, "utf-8");
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read .env file: ${reason}`);
    }

    const values = Object.entries(parseDotenv(fileContent)).map(([key, value]) => ({ key, value }));
    return {
      filePath,
      values,
    };
  });

  ipcMain.handle("stories:save", async (_event, data: unknown) => {
    saveStories(data);
  });

  ipcMain.handle("stories:load", async () => {
    return loadStories(null);
  });

  ipcMain.handle("stories:export", async (_event, data: unknown, suggestedFileName?: string) => {
    const targetWindow = mainWindow && !mainWindow.isDestroyed() ? mainWindow : settingsWindow;
    const result = await dialog.showSaveDialog(targetWindow ?? undefined, {
      defaultPath: path.join(app.getPath("documents"), getPortableExportFilename(suggestedFileName)),
      filters: [
        { name: "Storywright Story", extensions: ["json"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), "utf-8");
    return result.filePath;
  });

  ipcMain.handle("stories:import", async () => {
    const targetWindow = mainWindow && !mainWindow.isDestroyed() ? mainWindow : settingsWindow;
    const result = await dialog.showOpenDialog(targetWindow ?? undefined, {
      properties: ["openFile"],
      filters: [
        { name: "Storywright Story", extensions: ["json"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    let fileContent: string;
    try {
      fileContent = fs.readFileSync(filePath, "utf-8");
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read import file: ${reason}`);
    }

    try {
      return JSON.parse(fileContent);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse import file: ${reason}`);
    }
  });

  ipcMain.handle("environment:get-presence", async (_event, names: string[]) => {
    const resolvedEnv = getResolvedEnvironment();
    return Object.fromEntries(
      names.map((name) => [name, resolvedEnv[name] !== undefined]),
    );
  });

  ipcMain.handle("environment:get-source-status", async () => {
    return inspectEnvironmentSource(process.env, loadEnvironmentSettings());
  });

  ipcMain.handle("local-state:save", async (_event, key: keyof typeof LOCAL_STATE_FILENAMES, data: unknown) => {
    if (key === "environment") {
      saveLocalState(key, normalizeEnvironmentSettings(data as EnvironmentSettings));
      return;
    }

    saveLocalState(key, data);
  });

  ipcMain.handle("local-state:load", async (_event, key: keyof typeof LOCAL_STATE_FILENAMES) => {
    return loadLocalState(key, null);
  });

  ipcMain.handle("preview:get-state", async () => getPreviewState());

  ipcMain.handle(
    "preview:set-bounds",
    async (_event, bounds: { x: number; y: number; width: number; height: number }) => {
      previewBounds = {
        x: Math.max(0, Math.round(bounds.x)),
        y: Math.max(0, Math.round(bounds.y)),
        width: Math.max(0, Math.round(bounds.width)),
        height: Math.max(0, Math.round(bounds.height)),
      };
      syncPreviewViews();
    },
  );

  ipcMain.handle("preview:create-tab", async (_event, url?: string) => {
    createPreviewTab(url ?? "");
  });

  ipcMain.handle("preview:close-tab", async (_event, tabId: string) => {
    closePreviewTab(tabId);
  });

  ipcMain.handle("preview:activate-tab", async (_event, tabId: string) => {
    if (!previewTabs.some((tab) => tab.id === tabId)) return;
    activePreviewTabId = tabId;
    syncPreviewViews();
    sendPreviewState();
  });

  ipcMain.handle("preview:load-url", async (_event, url: string) => {
    const activeTab = getActivePreviewTab() ?? createPreviewTab();
    activeTab.loading = true;
    activeTab.title = "読み込み中...";
    activeTab.url = url;
    activeTab.view.webContents.loadURL(url).catch(() => {});
    sendPreviewState();
  });

  ipcMain.handle("preview:go-back", async () => {
    const wc = getActivePreviewContents();
    if (wc && canNavigateBack(wc)) {
      navigateBack(wc);
    }
  });

  ipcMain.handle("preview:go-forward", async () => {
    const wc = getActivePreviewContents();
    if (wc && canNavigateForward(wc)) {
      navigateForward(wc);
    }
  });

  ipcMain.handle("preview:reload", async () => {
    getActivePreviewContents()?.reload();
  });

  ipcMain.handle("start-recording", async () => {
    const allWc = getAllPreviewContents();
    if (allWc.length === 0) {
      throw new Error("Preview が見つかりません。Preview タブを開いてください。");
    }
    isRecording = true;
    for (const wc of allWc) {
      setupRecorderOnWebview(wc);
    }
  });

  ipcMain.handle("stop-recording", async () => {
    isRecording = false;
    teardownRecorder();
  });

  ipcMain.handle("toggle-assert-mode", async (_event, enabled: boolean) => {
    for (const id of recordingWebContentsIds) {
      try {
        const wc = webContents.fromId(id);
        if (wc && !wc.isDestroyed()) {
          wc.executeJavaScript(`window.__storywrightSetAssertMode(${enabled})`)
            .catch(() => {});
        }
      } catch { /* ignore */ }
    }
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

  // DOM 安定待機: MutationObserver で変更を監視し、
  // quietMs の間変更がなければ「安定した」と判断する
  function waitForDomSettle(timeoutMs, quietMs) {
    timeoutMs = timeoutMs || 3000;
    quietMs = quietMs || 150;
    return new Promise(function(resolve) {
      var timer = null;
      var observer = new MutationObserver(function() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(function() {
          observer.disconnect();
          resolve();
        }, quietMs);
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
      });
      // 初回タイマー: DOM 変更が一切なくても quietMs 後に解決
      timer = setTimeout(function() {
        observer.disconnect();
        resolve();
      }, quietMs);
      // 最大待機ガード
      setTimeout(function() {
        if (timer) clearTimeout(timer);
        observer.disconnect();
        resolve();
      }, timeoutMs);
    });
  }

  window.__storywrightExecuteStep = async function(step) {
    var timeout = 10000;

    switch (step.action) {
      case 'click': {
        var el = await waitForElement(step.target, timeout);
        el.scrollIntoView({ block: 'center' });
        el.click();
        await waitForDomSettle();
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
        await waitForDomSettle();
        return { status: 'passed' };
      }
      case 'select': {
        var sel = await waitForElement(step.target, timeout);
        sel.scrollIntoView({ block: 'center' });
        sel.value = step.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        await waitForDomSettle();
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

  const SLOW_MO = 50; // ステップ間の最小待機(ms) — DOM安定待機は webview 側で実施
  let currentRunId = 0;

  async function runStoryOnWebview(story: StoryInput, keepSession: boolean, runId: number): Promise<{
    storyId: string;
    status: "passed" | "failed";
    stepResults: StepResult[];
  }> {
    const wc = getActivePreviewContents();
    if (!wc) {
      throw new Error("Preview が見つかりません。Preview タブを開いてください。");
    }

    // セッションクリア
    if (!keepSession) {
      await wc.session.clearStorageData();
      await wc.session.clearCache();
    }

    // CDP を準備
    try { wc.debugger.attach("1.3"); } catch { /* already attached */ }
    await wc.debugger.sendCommand("Runtime.enable");

    // 最初のステップが navigate ならそこでエンジン注入するのでスキップ
    const firstStep = story.steps[0];
    if (!firstStep || firstStep.action !== "navigate") {
      await wc.debugger.sendCommand("Runtime.evaluate", {
        expression: EXECUTOR_INJECTION_SCRIPT,
        returnByValue: true,
      });
    }

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
          // CDP で navigate + Runtime.evaluate でエンジン注入
          // executeJavaScript はページロード完了を待つため遅い。
          // Runtime.evaluate ならロード中でもスクリプトを注入できる。
          try { wc.debugger.attach("1.3"); } catch { /* already attached */ }
          await wc.debugger.sendCommand("Page.enable");
          await wc.debugger.sendCommand("Runtime.enable");
          wc.debugger.sendCommand("Page.navigate", { url });
          // JS コンテキストが使えるようになるまでポーリング（CDP経由）
          for (let attempt = 0; attempt < 50; attempt++) {
            try {
              const evalResult = await wc.debugger.sendCommand("Runtime.evaluate", {
                expression: "document.readyState",
                returnByValue: true,
              }) as { result?: { value?: string } };
              if (evalResult.result?.value === "interactive" || evalResult.result?.value === "complete") {
                break;
              }
            } catch { /* context not ready */ }
            await new Promise((r) => setTimeout(r, 100));
          }
          await wc.debugger.sendCommand("Runtime.evaluate", {
            expression: EXECUTOR_INJECTION_SCRIPT,
            returnByValue: true,
          });
        } else {
          // CDP Runtime.evaluate でステップ実行（executeJavaScript はページロード待ちで遅い）
          try { wc.debugger.attach("1.3"); } catch { /* already attached */ }
          await wc.debugger.sendCommand("Runtime.enable");
          // エンジンが注入されていなければ注入
          await wc.debugger.sendCommand("Runtime.evaluate", {
            expression: EXECUTOR_INJECTION_SCRIPT,
            returnByValue: true,
          });
          const evalResult = await wc.debugger.sendCommand("Runtime.evaluate", {
            expression: `window.__storywrightExecuteStep(${JSON.stringify(step)})`,
            returnByValue: true,
            awaitPromise: true,
          }) as { result?: { value?: { status?: string; error?: string } }; exceptionDetails?: { text?: string } };
          if (evalResult.exceptionDetails) {
            throw new Error(evalResult.exceptionDetails.text || "Step execution failed");
          }
          const result = evalResult.result?.value;
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
    const story: StoryInput = resolveStoryEnvironmentVariables(JSON.parse(storyJson), getResolvedEnvironment());
    const runId = ++currentRunId;
    return runStoryOnWebview(story, keepSession ?? false, runId);
  });

  ipcMain.handle("cancel-run", async () => {
    currentRunId++;
  });

  // === 繰り返し実行 ===

  let repeatCancelled = false;

  ipcMain.handle("run-story-repeat", async (_event, storyJson: string, repeatCount: number, keepSession?: boolean) => {
    const story: StoryInput = resolveStoryEnvironmentVariables(JSON.parse(storyJson), getResolvedEnvironment());
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
  app.setName("Storywright");
  buildApplicationMenu();
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
