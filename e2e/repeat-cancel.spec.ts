import { test, expect } from "@playwright/test";
import { launchStorywright, startFixtureSite } from "./helpers/app";

/**
 * 繰り返し実行中にキャンセルすると、残りの iteration がスキップされることを検証。
 *
 * 10回繰り返しを設定し、進捗が表示されたらキャンセル。
 * 結果サマリーが「10/10 passed」にならない（途中で止まっている）ことを確認。
 */
test("cancelling repeat execution stops remaining iterations", async () => {
  const fixtureSite = await startFixtureSite();
  const session = await launchStorywright({
    urlHistory: {
      lastBaseUrl: fixtureSite.origin,
      history: [fixtureSite.origin],
    },
    stories: {
      schemaVersion: 1,
      stories: {
        "story-slow": {
          id: "story-slow",
          title: "Slow Story",
          baseUrl: fixtureSite.origin,
          metadata: { createdAt: Date.now() },
          steps: [
            { id: "s1", order: 1, action: "navigate", target: `${fixtureSite.origin}/item`, value: "", description: "" },
            { id: "s2", order: 2, action: "click", target: "#add-to-cart", value: "", description: "" },
            { id: "s3", order: 3, action: "assert", target: "#status", value: "カート追加完了", description: "" },
            { id: "s4", order: 4, action: "navigate", target: `${fixtureSite.origin}/item-b`, value: "", description: "" },
            { id: "s5", order: 5, action: "click", target: "#buy-second", value: "", description: "" },
            { id: "s6", order: 6, action: "assert", target: "#status-b", value: "別商品の追加完了", description: "" },
          ],
        },
      },
    },
  });

  try {
    const { mainWindow } = session;
    await mainWindow.getByRole("button", { name: /Slow Story/ }).click();

    // 10回繰り返しに設定
    const repeatInput = mainWindow.locator(".run-count-input");
    await repeatInput.fill("10");

    await mainWindow.getByRole("button", { name: /Run/ }).click();

    // 進捗表示 "Running (N/10)..." が出るまで待つ
    const stopButton = mainWindow.locator("button.btn-danger");
    await expect(stopButton).toBeVisible({ timeout: 15000 });

    // 少なくとも1回は完了するのを待ってからキャンセル
    await expect(stopButton).toContainText(/Running \([1-9]/, { timeout: 15000 });
    await stopButton.click();

    // キャンセル後、結果サマリーが表示される
    await expect(mainWindow.locator(".repeat-summary")).toBeVisible({ timeout: 15000 });

    // 10/10 にはなっていない（途中で止まった）
    const summaryText = await mainWindow.locator(".repeat-summary").textContent();
    expect(summaryText).not.toContain("10/10");
  } finally {
    await session.close();
    await fixtureSite.close();
  }
});
