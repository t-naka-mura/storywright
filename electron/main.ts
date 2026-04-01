const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { chromium } = require("playwright");

let mainWindow: BrowserWindow | null = null;
let previewWindow: BrowserWindow | null = null;

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
