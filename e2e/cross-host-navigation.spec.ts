import { test, expect } from "@playwright/test";
import { launchStorywright, startFixtureSite } from "./helpers/app";

/**
 * クロスホストナビゲーション — seed ベースの再生テスト
 *
 * BASE や Stores のようにショップとカートで baseUrl が分かれるケースを想定。
 * localhost:PORT (shop) → 127.0.0.1:PORT (cart) へのホスト跨ぎナビゲーションを含む
 * story を seed データで作成し、Run で全ステップが pass することを検証する。
 */
test("cross-host navigation: seed story runs across different hosts", async () => {
  const fixtureSite = await startFixtureSite();
  const session = await launchStorywright({
    urlHistory: {
      lastBaseUrl: fixtureSite.localhostOrigin,
      history: [fixtureSite.localhostOrigin],
    },
    stories: {
      schemaVersion: 1,
      stories: {
        "story-cross-host": {
          id: "story-cross-host",
          title: "Cross-Host Checkout",
          baseUrl: fixtureSite.localhostOrigin,
          metadata: { createdAt: Date.now() },
          steps: [
            {
              id: "s1",
              order: 1,
              action: "navigate",
              target: `${fixtureSite.localhostOrigin}/cross-host-shop`,
              value: "",
              description: "",
            },
            {
              id: "s2",
              order: 2,
              action: "click",
              target: "#go-to-cart",
              value: "",
              description: "",
            },
            {
              id: "s3",
              order: 3,
              action: "assert",
              target: "#cart-status",
              value: "注文確定",
              description: "",
            },
          ],
        },
      },
    },
  });

  try {
    const { mainWindow } = session;

    await mainWindow.getByRole("button", { name: /Cross-Host Checkout/ }).click();
    await mainWindow.getByRole("button", { name: /Run/ }).click();

    await expect(mainWindow.locator(".step-order-passed")).toHaveCount(3);
    await expect(mainWindow.getByRole("button", { name: /Run/ })).toBeVisible();
  } finally {
    await session.close();
    await fixtureSite.close();
  }
});

/**
 * クロスホストナビゲーション — 複数回 run テスト (keepSession: false)
 *
 * ホスト跨ぎ story を3回繰り返し実行し、毎回安定して pass することを検証。
 * セッションクリアで毎回クリーンな状態から実行される。
 */
test("cross-host navigation: repeat run with session clear", async () => {
  const fixtureSite = await startFixtureSite();
  const session = await launchStorywright({
    urlHistory: {
      lastBaseUrl: fixtureSite.localhostOrigin,
      history: [fixtureSite.localhostOrigin],
    },
    stories: {
      schemaVersion: 1,
      stories: {
        "story-cross-host-repeat": {
          id: "story-cross-host-repeat",
          title: "Cross-Host Repeat",
          baseUrl: fixtureSite.localhostOrigin,
          metadata: { createdAt: Date.now() },
          steps: [
            {
              id: "s1",
              order: 1,
              action: "navigate",
              target: `${fixtureSite.localhostOrigin}/cross-host-shop`,
              value: "",
              description: "",
            },
            {
              id: "s2",
              order: 2,
              action: "click",
              target: "#go-to-cart",
              value: "",
              description: "",
            },
            {
              id: "s3",
              order: 3,
              action: "assert",
              target: "#cart-status",
              value: "注文確定",
              description: "",
            },
          ],
        },
      },
    },
  });

  try {
    const { mainWindow } = session;
    await mainWindow.getByRole("button", { name: /Cross-Host Repeat/ }).click();

    const repeatInput = mainWindow.locator(".run-count-input");
    await repeatInput.fill("3");

    const keepSessionCheckbox = mainWindow.getByLabel("セッションを維持");
    await expect(keepSessionCheckbox).not.toBeChecked();

    await mainWindow.getByRole("button", { name: /Run/ }).click();

    await expect(mainWindow.locator(".repeat-summary")).toBeVisible({ timeout: 30000 });
    await expect(mainWindow.locator(".repeat-summary")).toContainText("3/3 passed");
  } finally {
    await session.close();
    await fixtureSite.close();
  }
});
