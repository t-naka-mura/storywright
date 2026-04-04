import { _electron as electron, type ElectronApplication, type Page } from "playwright";
import { createServer, type Server } from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type SeedData = {
  stories?: unknown;
  urlHistory?: unknown;
  environment?: unknown;
};

type LaunchSession = {
  electronApp: ElectronApplication;
  mainWindow: Page;
  userDataDir: string;
  close: () => Promise<void>;
};

type LaunchOptions = {
  userDataDir?: string;
  cleanupUserDataDir?: boolean;
};

type FixtureServer = {
  origin: string;
  close: () => Promise<void>;
};

type PersistedStoryStep = {
  id: string;
  order: number;
  action: "navigate" | "click" | "assert";
  target: string;
  value: string;
  description: string;
};

type PersistedStory = {
  id: string;
  title: string;
  baseUrl: string;
  metadata: { createdAt: number };
  steps: PersistedStoryStep[];
};

const ROOT_DIR = path.resolve(__dirname, "..", "..");

async function writeJsonFile(filePath: string, data: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

export async function createSeededUserDataDir(seed: SeedData = {}): Promise<string> {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "storywright-e2e-"));
  const dataDir = path.join(userDataDir, "data");
  await mkdir(dataDir, { recursive: true });

  if (seed.stories !== undefined) {
    await writeJsonFile(path.join(dataDir, "stories.json"), seed.stories);
  }
  if (seed.urlHistory !== undefined) {
    await writeJsonFile(path.join(dataDir, "urlHistory.json"), seed.urlHistory);
  }
  if (seed.environment !== undefined) {
    await writeJsonFile(path.join(dataDir, "environment.json"), seed.environment);
  }

  return userDataDir;
}

export async function launchStorywright(seed: SeedData = {}, options: LaunchOptions = {}): Promise<LaunchSession> {
  const shouldCleanupUserDataDir = options.cleanupUserDataDir ?? !options.userDataDir;
  const userDataDir = options.userDataDir ?? await createSeededUserDataDir(seed);
  const electronApp = await electron.launch({
    cwd: ROOT_DIR,
    args: [path.join(ROOT_DIR, "dist-electron/main.js")],
    env: {
      ...process.env,
      STORYWRIGHT_USER_DATA_DIR: userDataDir,
      STORYWRIGHT_ENABLE_TEST_API: "1",
    },
  });

  const mainWindow = await electronApp.firstWindow();
  await mainWindow.waitForLoadState("domcontentloaded");
  await mainWindow.getByPlaceholder("https://example.com").waitFor();

  return {
    electronApp,
    mainWindow,
    userDataDir,
    close: async () => {
      await electronApp.close();
      if (shouldCleanupUserDataDir) {
        await rm(userDataDir, { recursive: true, force: true });
      }
    },
  };
}

export async function getPreviewBounds(page: Page) {
  return page.evaluate(async () => {
    return window.storywright.testGetPreviewBounds?.() ?? null;
  });
}

export async function getActivePreviewUrl(page: Page) {
  return page.evaluate(async () => {
    const state = await window.storywright.getPreviewState();
    const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId);
    return activeTab?.url ?? null;
  });
}

export async function evaluateInPreview(page: Page, script: string) {
  return page.evaluate(async (source) => {
    return window.storywright.testEvaluatePreview?.(source) ?? null;
  }, script);
}

export async function clickInPreview(page: Page, selector: string) {
  const selectorLiteral = JSON.stringify(selector);
  await evaluateInPreview(page, `(() => {
    const target = document.querySelector(${selectorLiteral});
    if (!(target instanceof HTMLElement)) {
      throw new Error('Preview element not found: ' + ${selectorLiteral});
    }
    target.click();
    return true;
  })()`);
}

export async function persistStories(page: Page, stories: PersistedStory[]) {
  await page.evaluate(async (persistedStories) => {
    await window.storywright.saveStories({
      schemaVersion: 1,
      stories: Object.fromEntries(
        persistedStories.map((story) => [story.id, story]),
      ),
    });
  }, stories);
}

export async function openSettingsWindow(electronApp: ElectronApplication, page: Page) {
  const settingsWindowPromise = electronApp.waitForEvent("window", {
    predicate: async (candidate) => {
      try {
        return candidate.url().includes("#/settings");
      } catch {
        return false;
      }
    },
  });

  await page.evaluate(async () => {
    await window.storywright.testOpenSettings?.();
  });

  const settingsWindow = await settingsWindowPromise;
  await settingsWindow.waitForLoadState("domcontentloaded");
  await settingsWindow.getByRole("heading", { name: "Settings" }).waitFor();
  return settingsWindow;
}

export async function startFixtureSite(): Promise<FixtureServer> {
  const server = createServer((request, response) => {
    const requestUrl = request.url ?? "/";

    if (requestUrl === "/" || requestUrl === "/index.html") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
        <html>
          <body>
            <main>
              <h1>Fixture Home</h1>
              <a href="/item" id="go-item">商品ページへ</a>
            </main>
          </body>
        </html>`);
      return;
    }

    if (requestUrl === "/item") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
        <html>
          <body>
            <main>
              <h1>商品ページ</h1>
              <button id="add-to-cart">カートに入れる</button>
              <script>
                document.getElementById('add-to-cart').addEventListener('click', () => {
                  window.location.href = '/cart';
                });
              </script>
            </main>
          </body>
        </html>`);
      return;
    }

    if (requestUrl === "/cart") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
        <html>
          <body>
            <main>
              <h1 id="status">カート追加完了</h1>
            </main>
          </body>
        </html>`);
      return;
    }

    if (requestUrl === "/item-b") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
        <html>
          <body>
            <main>
              <h1>商品ページB</h1>
              <button id="buy-second">別商品を追加</button>
              <script>
                document.getElementById('buy-second').addEventListener('click', () => {
                  window.location.href = '/cart-b';
                });
              </script>
            </main>
          </body>
        </html>`);
      return;
    }

    if (requestUrl === "/cart-b") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
        <html>
          <body>
            <main>
              <h1 id="status-b">別商品の追加完了</h1>
            </main>
          </body>
        </html>`);
      return;
    }

    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("not found");
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start fixture site");
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}