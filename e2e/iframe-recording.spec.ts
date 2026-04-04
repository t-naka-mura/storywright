import { expect, test } from "@playwright/test";
import { clickInPreview, clickInPreviewFrame, fillInPreviewFrame, getActivePreviewUrl, launchStorywright, loadPreviewUrl, startFixtureSite, waitForRecordedStepCount } from "./helpers/app";

test("iframe-embedded checkout can be recorded and replayed as a story", async () => {
  const fixtureSite = await startFixtureSite();
  const session = await launchStorywright({
    urlHistory: {
      lastBaseUrl: fixtureSite.origin,
      history: [fixtureSite.origin],
    },
  });

  try {
    const { mainWindow } = session;
    await loadPreviewUrl(mainWindow, fixtureSite.origin);
    await expect.poll(async () => await getActivePreviewUrl(mainWindow)).toContain(fixtureSite.origin);

    await mainWindow.getByRole("button", { name: /REC/ }).click();
    await clickInPreview(mainWindow, "#go-checkout-iframe");
    await expect.poll(async () => await getActivePreviewUrl(mainWindow)).toContain("/checkout-iframe");

    await fillInPreviewFrame(mainWindow, "#paypal-frame", "#paypal-email", "buyer@example.com");
    await fillInPreviewFrame(mainWindow, "#paypal-frame", "#paypal-password", "buyer-password");
    await clickInPreviewFrame(mainWindow, "#paypal-frame", "#paypal-submit");

    await mainWindow.getByRole("button", { name: /Assert/ }).click();
    await clickInPreview(mainWindow, "#payment-status");
    await waitForRecordedStepCount(mainWindow, 5);

    await mainWindow.getByRole("button", { name: /Stop/ }).click();
    const stepCount = await mainWindow.locator(".step-item").count();
    expect(stepCount).toBeGreaterThanOrEqual(5);
    await expect(mainWindow.getByText("••••••")).toBeVisible();

    await mainWindow.getByRole("button", { name: /Run/ }).click();
    await expect(mainWindow.locator(".step-order-passed")).toHaveCount(stepCount);
  } finally {
    await session.close();
    await fixtureSite.close();
  }
});