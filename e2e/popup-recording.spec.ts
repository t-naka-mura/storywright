import { expect, test } from "@playwright/test";
import { clickInPreview, evaluateInPreview, fillInPreview, getActivePreviewUrl, launchStorywright, loadPreviewUrl, startFixtureSite, waitForRecordedStepCount } from "./helpers/app";

test("popup PayPal login can be recorded and replayed as a story", async () => {
  const fixtureSite = await startFixtureSite();
  const session = await launchStorywright({
    urlHistory: {
      lastBaseUrl: fixtureSite.origin,
      history: [fixtureSite.origin],
    },
  });

  try {
    const { mainWindow } = session;
    // REC 開始
    await mainWindow.getByRole("button", { name: /REC/ }).click();
    await waitForRecordedStepCount(mainWindow, 0);

    // recorder の CDP ドメイン初期化を待つ
    await new Promise(r => setTimeout(r, 300));

    // checkout-popup へナビゲート（navigate ステップとして記録される）
    await loadPreviewUrl(mainWindow, `${fixtureSite.origin}/checkout-popup`);
    await expect.poll(async () => await getActivePreviewUrl(mainWindow)).toContain("/checkout-popup");
    await waitForRecordedStepCount(mainWindow, 1);

    // PayPal ボタンをクリック → popup が開く
    await clickInPreview(mainWindow, "#pay-with-paypal");

    // popup タブが開いて URL がロードされるのを待つ
    await expect.poll(async () => await getActivePreviewUrl(mainWindow)).toContain("/popup-paypal");

    // popup 内の recorder が注入されるのを待つ
    await expect.poll(async () => {
      return evaluateInPreview(mainWindow, "Boolean(window.__storywrightRecorder)");
    }).toBe(true);

    // popup 内で操作
    await fillInPreview(mainWindow, "#pp-email", "buyer@example.com");
    await fillInPreview(mainWindow, "#pp-password", "secret123");
    await clickInPreview(mainWindow, "#pp-submit");

    // popup が閉じてメインタブに戻るのを待つ
    await expect.poll(async () => await getActivePreviewUrl(mainWindow)).toContain("/checkout-popup");

    // メインタブで assert
    await mainWindow.getByRole("button", { name: /Assert/ }).click();
    await clickInPreview(mainWindow, "#payment-status");

    // 期待ステップ数:
    // navigate /checkout-popup,
    // click "PayPal で支払う", activate-tab /popup-paypal, navigate /popup-paypal,
    // type #pp-email, type #pp-password, click #pp-submit,
    // activate-tab /checkout-popup, assert #payment-status
    await waitForRecordedStepCount(mainWindow, 8);

    // 録画停止
    await mainWindow.getByRole("button", { name: /Stop/ }).click();
    const stepCount = await mainWindow.locator(".step-item").count();
    expect(stepCount).toBeGreaterThanOrEqual(8);

    // Run で全ステップ pass を検証
    await mainWindow.getByRole("button", { name: /Run/ }).click();
    await expect(mainWindow.locator(".step-order-passed")).toHaveCount(stepCount, { timeout: 30000 });
  } finally {
    await session.close();
    await fixtureSite.close();
  }
});
