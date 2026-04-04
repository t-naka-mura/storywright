import { expect, test } from "@playwright/test";
import { clickInPreview, evaluateInPreview, getActivePreviewUrl, launchStorywright, startFixtureSite, waitForRecordedStepCount } from "./helpers/app";

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
    await waitForRecordedStepCount(mainWindow, 0);
    await expect.poll(async () => {
      return evaluateInPreview(mainWindow, "Boolean(window.__storywrightRecorder)");
    }).toBe(true);

    await clickInPreview(mainWindow, "#go-item");
    await expect.poll(async () => await getActivePreviewUrl(mainWindow)).toContain("/item");
    await waitForRecordedStepCount(mainWindow, 3);

    await clickInPreview(mainWindow, "#add-to-cart");
    await expect.poll(async () => await getActivePreviewUrl(mainWindow)).toContain("/cart");
    await waitForRecordedStepCount(mainWindow, 5);

    await mainWindow.getByRole("button", { name: /Assert/ }).click();
    await clickInPreview(mainWindow, "#status");
    await waitForRecordedStepCount(mainWindow, 6);

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