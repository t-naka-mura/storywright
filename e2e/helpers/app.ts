import { _electron as electron, type ElectronApplication, type Page } from "playwright";
import { expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
  localhostOrigin: string;
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
  const { ELECTRON_RUN_AS_NODE: _drop, ...cleanEnv } = process.env;
  const electronApp = await electron.launch({
    cwd: ROOT_DIR,
    args: [path.join(ROOT_DIR, "dist-electron/main.js")],
    env: {
      ...cleanEnv,
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

export async function loadPreviewUrl(page: Page, url: string) {
  await page.evaluate(async (nextUrl) => {
    await window.storywright.loadPreviewUrl(nextUrl);
  }, url);
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

export async function fillInPreview(page: Page, selector: string, value: string) {
  const selectorLiteral = JSON.stringify(selector);
  const valueLiteral = JSON.stringify(value);
  await evaluateInPreview(page, `(() => {
    const target = document.querySelector(${selectorLiteral});
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) {
      throw new Error('Preview input not found: ' + ${selectorLiteral});
    }
    target.focus();
    const prototype = target instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    descriptor?.set?.call(target, ${valueLiteral});
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    target.blur();
    return true;
  })()`);
}

export async function selectInPreview(page: Page, selector: string, value: string) {
  const selectorLiteral = JSON.stringify(selector);
  const valueLiteral = JSON.stringify(value);
  await evaluateInPreview(page, `(() => {
    const target = document.querySelector(${selectorLiteral});
    if (!(target instanceof HTMLSelectElement)) {
      throw new Error('Preview select not found: ' + ${selectorLiteral});
    }
    target.value = ${valueLiteral};
    target.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
}

export async function clickInPreviewFrame(page: Page, frameSelector: string, selector: string) {
  const frameLiteral = JSON.stringify(frameSelector);
  const selectorLiteral = JSON.stringify(selector);
  await evaluateInPreview(page, `(async () => {
    function getTarget() {
      const frame = document.querySelector(${frameLiteral});
      if (!(frame instanceof HTMLIFrameElement) || !frame.contentDocument) {
        return null;
      }
      return frame.contentDocument.querySelector(${selectorLiteral});
    }
    const start = Date.now();
    while (Date.now() - start < 5000) {
      const candidate = getTarget();
      if (candidate && typeof candidate === 'object' && 'click' in candidate) {
        candidate.click();
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const target = getTarget();
    if (!target || typeof target !== 'object' || !('click' in target)) {
      throw new Error('Preview iframe element not found: ' + ${selectorLiteral});
    }
    target.click();
    return true;
  })()`);
}

export async function fillInPreviewFrame(page: Page, frameSelector: string, selector: string, value: string) {
  const frameLiteral = JSON.stringify(frameSelector);
  const selectorLiteral = JSON.stringify(selector);
  const valueLiteral = JSON.stringify(value);
  await evaluateInPreview(page, `(async () => {
    function getTarget() {
      const frame = document.querySelector(${frameLiteral});
      if (!(frame instanceof HTMLIFrameElement) || !frame.contentDocument) {
        return null;
      }
      return frame.contentDocument.querySelector(${selectorLiteral});
    }
    const start = Date.now();
    let target = null;
    while (Date.now() - start < 5000) {
      const candidate = getTarget();
      if (candidate && typeof candidate === 'object' && 'focus' in candidate && 'blur' in candidate && 'dispatchEvent' in candidate) {
        target = candidate;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (!target || typeof target !== 'object' || !('ownerDocument' in target)) {
      throw new Error('Preview iframe input not found: ' + ${selectorLiteral});
    }
    target.focus();
    const frameWindow = target.ownerDocument?.defaultView;
    const isTextarea = (target.tagName || '').toLowerCase() === 'textarea';
    const prototype = isTextarea
      ? frameWindow?.HTMLTextAreaElement?.prototype
      : frameWindow?.HTMLInputElement?.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    descriptor?.set?.call(target, ${valueLiteral});
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    target.blur();
    return true;
  })()`);
}

export async function readUserDataJson<T>(userDataDir: string, filename: string): Promise<T> {
  const content = await readFile(path.join(userDataDir, 'data', filename), 'utf8');
  return JSON.parse(content) as T;
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

export async function testExportToFile(page: Page, data: unknown, filePath: string): Promise<string> {
  return page.evaluate(async ({ d, p }) => {
    return window.storywright.testExportToFile?.(d, p) ?? '';
  }, { d: data, p: filePath });
}

export async function testImportFromFile(page: Page, filePath: string): Promise<unknown> {
  return page.evaluate(async (p) => {
    return window.storywright.testImportFromFile?.(p) ?? null;
  }, filePath);
}

export async function waitForRecordedStepCount(page: Page, count: number) {
  await expect.poll(async () => {
    const text = await page.locator(".preview-recording-badge").textContent();
    const match = text?.match(/(\d+) ステップ記録済み/);
    return match ? Number(match[1]) : -1;
  }, { timeout: 15000 }).toBeGreaterThanOrEqual(count);
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
              <a href="/account" id="go-account">アカウント設定へ</a>
              <a href="/login" id="go-login">ログインへ</a>
              <a href="/checkout-iframe" id="go-checkout-iframe">埋め込み決済へ</a>
            </main>
          </body>
        </html>`);
      return;
    }

    if (requestUrl === "/account") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
        <html>
          <body>
            <main>
              <h1>Account Setup</h1>
              <label for="username">Username</label>
              <input id="username" name="username" autocomplete="off" />
              <label for="password">Password</label>
              <input id="password" name="password" type="password" autocomplete="off" />
              <label for="role">Role</label>
              <select id="role" name="role">
                <option value="">Choose role</option>
                <option value="admin">admin</option>
                <option value="editor">editor</option>
              </select>
              <button id="submit-account">送信</button>
              <script>
                document.getElementById('submit-account').addEventListener('click', () => {
                  const user = document.getElementById('username').value;
                  const role = document.getElementById('role').value;
                  const params = new URLSearchParams({ user, role });
                  window.location.href = '/account/confirm?' + params.toString();
                });
              </script>
            </main>
          </body>
        </html>`);
      return;
    }

    if (requestUrl.startsWith("/account/confirm")) {
      const url = new URL(requestUrl, 'http://127.0.0.1');
      const user = url.searchParams.get('user') ?? '';
      const role = url.searchParams.get('role') ?? '';
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
        <html>
          <body>
            <main>
              <h1 id="account-status">設定完了</h1>
              <p id="submitted-user">${user}</p>
              <p id="submitted-role">${role}</p>
            </main>
          </body>
        </html>`);
      return;
    }

    if (requestUrl === "/checkout-iframe") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
        <html>
          <body>
            <main>
              <h1>Checkout</h1>
              <p id="payment-status">未ログイン</p>
              <iframe id="paypal-frame" src="/embedded-paypal" title="Embedded PayPal"></iframe>
              <script>
                window.addEventListener('message', (event) => {
                  if (!event.data || event.data.type !== 'paypal-login-success') return;
                  document.getElementById('payment-status').textContent = 'PayPal logged in as ' + event.data.email;
                });
              </script>
            </main>
          </body>
        </html>`);
      return;
    }

    if (requestUrl === "/embedded-paypal") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
        <html>
          <body>
            <main>
              <h1>PayPal Login</h1>
              <label for="paypal-email">Email</label>
              <input id="paypal-email" type="email" autocomplete="off" />
              <label for="paypal-password">Password</label>
              <input id="paypal-password" type="password" autocomplete="off" />
              <button id="paypal-submit">Log in</button>
              <script>
                document.getElementById('paypal-submit').addEventListener('click', () => {
                  const email = document.getElementById('paypal-email').value;
                  window.parent.postMessage({ type: 'paypal-login-success', email }, '*');
                });
              </script>
            </main>
          </body>
        </html>`);
      return;
    }

    if (requestUrl === "/login") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
        <html>
          <body>
            <main>
              <h1>Login</h1>
              <button id="do-login">ログインする</button>
              <script>
                document.getElementById('do-login').addEventListener('click', () => {
                  localStorage.setItem('loggedIn', 'true');
                  window.location.href = '/dashboard';
                });
              </script>
            </main>
          </body>
        </html>`);
      return;
    }

    if (requestUrl === "/dashboard") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
        <html>
          <body>
            <main>
              <h1 id="login-status">Loading...</h1>
              <script>
                var isLoggedIn = localStorage.getItem('loggedIn') === 'true';
                document.getElementById('login-status').textContent = isLoggedIn ? 'ログイン済み' : '未ログイン';
              </script>
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

    if (requestUrl === "/cross-host-shop") {
      const port = (server.address() as { port: number }).port;
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
        <html>
          <body>
            <main>
              <h1>Cross-Host Shop</h1>
              <p id="shop-host">${request.headers.host ?? ""}</p>
              <button id="go-to-cart">カートへ進む</button>
              <script>
                document.getElementById('go-to-cart').addEventListener('click', () => {
                  window.location.href = 'http://127.0.0.1:${port}/cross-host-cart';
                });
              </script>
            </main>
          </body>
        </html>`);
      return;
    }

    if (requestUrl === "/cross-host-cart") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
        <html>
          <body>
            <main>
              <h1>Cross-Host Cart</h1>
              <p id="cart-host">${request.headers.host ?? ""}</p>
              <p id="cart-status">注文確定</p>
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
    localhostOrigin: `http://localhost:${address.port}`,
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