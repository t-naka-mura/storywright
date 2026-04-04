import { expect, test } from "@playwright/test";
import { clickInPreview, evaluateInPreview, getActivePreviewUrl, launchStorywright, startFixtureSite } from "./helpers/app";

test("REC creates a runnable story from live preview interactions", async () => {
  const fixtureSite = await startFixtureSite();
  const session = await launchStorywright({
    urlHistory: {
      lastBaseUrl: fixtureSite.origin,
      history: [fixtureSite.origin],
    },
  });

  try {
    const { mainWindow } = session;

    await expect.poll(async () => await getActivePreviewUrl(mainWindow)).toContain(fixtureSite.origin);

    await mainWindow.getByRole("button", { name: /REC/ }).click();
    await expect(mainWindow.getByText(/録画中 — 0 ステップ記録済み/)).toBeVisible();
    await expect.poll(async () => {
      return evaluateInPreview(mainWindow, "Boolean(window.__storywrightRecorder)");
    }).toBe(true);

    await clickInPreview(mainWindow, "#go-item");
    await expect.poll(async () => await getActivePreviewUrl(mainWindow)).toContain("/item");
    await expect(mainWindow.getByText(/3 ステップ記録済み/)).toBeVisible();

    await clickInPreview(mainWindow, "#add-to-cart");
    await expect.poll(async () => await getActivePreviewUrl(mainWindow)).toContain("/cart");
    await expect(mainWindow.getByText(/5 ステップ記録済み/)).toBeVisible();

    await mainWindow.getByRole("button", { name: /Assert/ }).click();
    await clickInPreview(mainWindow, "#status");
    await expect(mainWindow.getByText(/6 ステップ記録済み/)).toBeVisible();

    await mainWindow.getByRole("button", { name: /Stop/ }).click();

    await expect(mainWindow.locator(".panel-header-title")).toContainText("録画 ");
    await expect(mainWindow.locator(".step-item")).toHaveCount(6);

    await mainWindow.getByRole("button", { name: /Run/ }).click();
    await expect(mainWindow.locator(".step-order-passed")).toHaveCount(6);
  } finally {
    await session.close();
    await fixtureSite.close();
  }
});