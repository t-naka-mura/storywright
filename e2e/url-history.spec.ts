import { test, expect } from "@playwright/test";
import { getPreviewBounds, launchStorywright, loadPreviewUrl, getActivePreviewUrl, startFixtureSite } from "./helpers/app";

test("URL history dropdown stays visible and pushes native preview bounds", async () => {
  const fixtureSite = await startFixtureSite();
  const session = await launchStorywright({
    urlHistory: {
      lastBaseUrl: fixtureSite.origin,
      history: [
        fixtureSite.origin,
        "https://admin.stgthebase.com",
        "https://example.com",
      ],
    },
  });

  try {
    const { mainWindow } = session;
    const input = mainWindow.getByPlaceholder("https://example.com");

    // プレビューが seed した URL をロード完了するまで待つ
    await loadPreviewUrl(mainWindow, fixtureSite.origin);
    await expect.poll(async () => await getActivePreviewUrl(mainWindow)).toContain(fixtureSite.origin);

    await mainWindow.waitForFunction(async () => {
      const bounds = await window.storywright.testGetPreviewBounds?.();
      return !!bounds && bounds.width > 0 && bounds.height > 0;
    });

    const beforeBounds = await getPreviewBounds(mainWindow);
    await input.click();

    await expect(mainWindow.getByRole("button", { name: fixtureSite.origin })).toBeVisible();
    const afterBounds = await getPreviewBounds(mainWindow);

    expect(beforeBounds).not.toBeNull();
    expect(afterBounds).not.toBeNull();
    expect(afterBounds!.y).toBeGreaterThan(beforeBounds!.y);
    expect(afterBounds!.height).toBeLessThan(beforeBounds!.height);
  } finally {
    await session.close();
    await fixtureSite.close();
  }
});