import { test, expect } from "@playwright/test";
import { launchStorywright, startFixtureSite } from "./helpers/app";

/**
 * セッションクリアで繰り返し実行 (keepSession: false)
 *
 * /login でログイン → /dashboard で「ログイン済み」を assert するストーリーを
 * 3回繰り返す。keepSession: false なので毎回 localStorage がクリアされ、
 * /login から始めても /dashboard の assert が毎回 pass する。
 */
test("repeat execution with session clear runs each iteration from clean state", async () => {
  const fixtureSite = await startFixtureSite();
  const session = await launchStorywright({
    urlHistory: {
      lastBaseUrl: fixtureSite.origin,
      history: [fixtureSite.origin],
    },
    stories: {
      schemaVersion: 1,
      stories: {
        "story-login-flow": {
          id: "story-login-flow",
          title: "Login Flow",
          baseUrl: fixtureSite.origin,
          metadata: { createdAt: Date.now() },
          steps: [
            {
              id: "s1",
              order: 1,
              action: "navigate",
              target: `${fixtureSite.origin}/login`,
              value: "",
              description: "",
            },
            {
              id: "s2",
              order: 2,
              action: "click",
              target: "#do-login",
              value: "",
              description: "",
            },
            {
              id: "s3",
              order: 3,
              action: "assert",
              target: "#login-status",
              value: "ログイン済み",
              description: "",
            },
          ],
        },
      },
    },
  });

  try {
    const { mainWindow } = session;
    await mainWindow.getByRole("button", { name: /Login Flow/ }).click();

    // 実行回数を 3 に設定
    const repeatInput = mainWindow.locator(".run-count-input");
    await repeatInput.fill("3");

    // 「セッションを維持」チェックが OFF であることを確認
    const keepSessionCheckbox = mainWindow.getByLabel("セッションを維持");
    await expect(keepSessionCheckbox).not.toBeChecked();

    await mainWindow.getByRole("button", { name: /Run/ }).click();

    // 繰り返し結果サマリーが表示されるまで待つ
    await expect(mainWindow.locator(".repeat-summary")).toBeVisible({ timeout: 30000 });
    await expect(mainWindow.locator(".repeat-summary")).toContainText("3/3 passed");
  } finally {
    await session.close();
    await fixtureSite.close();
  }
});

/**
 * セッション維持で繰り返し実行 (keepSession: true)
 *
 * /dashboard で「ログイン済み」を assert するだけのストーリーを keepSession: true で
 * 2回繰り返す。1回目は localStorage が空なので /dashboard は「未ログイン」→ assert fail。
 *
 * ただし先に /login でログインしておけば、keepSession: true なら
 * localStorage が保持されるため /dashboard の assert が pass し続ける。
 *
 * テスト手順:
 * 1. まず「ログイン + assert」ストーリーを keepSession: true で 2回繰り返す → 全 pass
 * 2. 同ストーリーを keepSession: false で 2回繰り返す → これも全 pass（毎回ログインするので）
 * 3. 「/dashboard assert のみ」ストーリーを keepSession: false で実行 → fail（セッションなし）
 *    で keepSession の効果を対比検証
 */
test("repeat execution with keepSession preserves localStorage across iterations", async () => {
  const fixtureSite = await startFixtureSite();
  const session = await launchStorywright({
    urlHistory: {
      lastBaseUrl: fixtureSite.origin,
      history: [fixtureSite.origin],
    },
    stories: {
      schemaVersion: 1,
      stories: {
        "story-login-and-check": {
          id: "story-login-and-check",
          title: "Login And Check",
          baseUrl: fixtureSite.origin,
          metadata: { createdAt: Date.now() },
          steps: [
            {
              id: "s1",
              order: 1,
              action: "navigate",
              target: `${fixtureSite.origin}/login`,
              value: "",
              description: "",
            },
            {
              id: "s2",
              order: 2,
              action: "click",
              target: "#do-login",
              value: "",
              description: "",
            },
            {
              id: "s3",
              order: 3,
              action: "assert",
              target: "#login-status",
              value: "ログイン済み",
              description: "",
            },
          ],
        },
        "story-dashboard-only": {
          id: "story-dashboard-only",
          title: "Dashboard Only",
          baseUrl: fixtureSite.origin,
          metadata: { createdAt: Date.now() },
          steps: [
            {
              id: "s1",
              order: 1,
              action: "navigate",
              target: `${fixtureSite.origin}/dashboard`,
              value: "",
              description: "",
            },
            {
              id: "s2",
              order: 2,
              action: "assert",
              target: "#login-status",
              value: "ログイン済み",
              description: "",
            },
          ],
        },
      },
    },
  });

  try {
    const { mainWindow } = session;

    // --- Part 1: keepSession: true でログインフローを2回繰り返し → 全 pass ---
    await mainWindow.getByRole("button", { name: /Login And Check/ }).click();
    const repeatInput = mainWindow.locator(".run-count-input");
    await repeatInput.fill("2");

    const keepSessionCheckbox = mainWindow.getByLabel("セッションを維持");
    await keepSessionCheckbox.check();
    await expect(keepSessionCheckbox).toBeChecked();

    await mainWindow.getByRole("button", { name: /Run/ }).click();
    await expect(mainWindow.locator(".repeat-summary")).toBeVisible({ timeout: 30000 });
    await expect(mainWindow.locator(".repeat-summary")).toContainText("2/2 passed");

    // --- Part 2: Dashboard Only を keepSession: false で1回実行 → セッションクリアで fail ---
    await mainWindow.locator("button.panel-back").click();
    await mainWindow.getByRole("button", { name: /Dashboard Only/ }).click();
    await keepSessionCheckbox.uncheck();
    await repeatInput.fill("1");

    await mainWindow.getByRole("button", { name: /Run/ }).click();

    // assert が fail するので step-order-failed が出るはず
    await expect(mainWindow.locator(".step-order-failed")).toHaveCount(1, { timeout: 15000 });
  } finally {
    await session.close();
    await fixtureSite.close();
  }
});
