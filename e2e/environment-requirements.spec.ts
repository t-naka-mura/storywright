import { expect, test } from "@playwright/test";
import { clickInPreview, fillInPreview, getActivePreviewUrl, launchStorywright, loadPreviewUrl, selectInPreview, startFixtureSite } from "./helpers/app";

test("recorded stories can be parameterized with multiple LOCAL_ENV keys and then replayed", async () => {
  const fixtureSite = await startFixtureSite();
  const firstSession = await launchStorywright({
    urlHistory: {
      lastBaseUrl: fixtureSite.origin,
      history: [fixtureSite.origin],
    },
  }, { cleanupUserDataDir: false });

  try {
    const { mainWindow } = firstSession;
    await loadPreviewUrl(mainWindow, fixtureSite.origin);
    await expect.poll(async () => await getActivePreviewUrl(mainWindow)).toContain(fixtureSite.origin);
    await mainWindow.getByRole("button", { name: /REC/ }).click();

    await clickInPreview(mainWindow, "#go-account");
    await expect.poll(async () => await getActivePreviewUrl(mainWindow)).toContain("/account");
    await fillInPreview(mainWindow, "#username", "seed-user");
    await fillInPreview(mainWindow, "#password", "seed-pass");
    await selectInPreview(mainWindow, "#role", "editor");
    await clickInPreview(mainWindow, "#submit-account");
    await expect.poll(async () => await getActivePreviewUrl(mainWindow)).toContain("/account/confirm");

    await mainWindow.getByRole("button", { name: /Assert/ }).click();
    await clickInPreview(mainWindow, "#submitted-role");
    await mainWindow.getByRole("button", { name: /Assert/ }).click();
    await clickInPreview(mainWindow, "#submitted-user");
    await mainWindow.getByRole("button", { name: /Stop/ }).click();
    await mainWindow.waitForTimeout(400);

    await mainWindow.evaluate(async (origin) => {
      const documentData = await window.storywright.loadStories() as {
        schemaVersion: number;
        stories: Record<string, {
          id: string;
          title: string;
          baseUrl?: string;
          steps: Array<{ order: number; action: string; target: string; value: string; sensitive?: boolean }>;
        }>;
      };
      const [story] = Object.values(documentData.stories);
      story.title = 'Environment Multi-Key Story';
      story.baseUrl = origin;
      const navigateConfirm = story.steps.find((step) => step.action === 'navigate' && step.target.includes('/account/confirm'));
      const usernameStep = story.steps.find((step) => step.action === 'type' && step.target.includes('Username'));
      const passwordStep = story.steps.find((step) => step.action === 'type' && step.sensitive === true);
      const roleStep = story.steps.find((step) => step.action === 'select');
      const roleAssert = story.steps.find((step) => step.action === 'assert' && step.target === '#submitted-role');
      const userAssert = story.steps.find((step) => step.action === 'assert' && step.target === '#submitted-user');
      if (!navigateConfirm || !usernameStep || !passwordStep || !roleStep || !roleAssert || !userAssert) {
        throw new Error('Recorded story shape did not match expected account flow');
      }
      usernameStep.value = '{{LOCAL_ENV.USERNAME}}';
      passwordStep.value = '{{LOCAL_ENV.PASSWORD}}';
      roleStep.value = '{{LOCAL_ENV.ROLE}}';
      navigateConfirm.target = '{{LOCAL_ENV.ORIGIN}}/account/confirm?user={{LOCAL_ENV.USERNAME}}&role={{LOCAL_ENV.ROLE}}';
      roleAssert.value = '{{LOCAL_ENV.ROLE}}';
      userAssert.value = '{{LOCAL_ENV.USERNAME}}';
      await window.storywright.saveStories(documentData);
    }, fixtureSite.origin);

    await firstSession.electronApp.close();

    const secondSession = await launchStorywright({}, {
      userDataDir: firstSession.userDataDir,
      cleanupUserDataDir: true,
    });

    try {
      const { electronApp, mainWindow: restoredWindow } = secondSession;
      await restoredWindow.getByRole("button", { name: /Environment Multi-Key Story/ }).click();
      await restoredWindow.getByRole("button", { name: /Run/ }).click();

      await expect(restoredWindow.locator('.dialog-title')).toHaveText('環境変数が不足しています');
      await expect(restoredWindow.locator('.dialog-message')).toContainText('LOCAL_ENV.ORIGIN');
      await expect(restoredWindow.locator('.dialog-message')).toContainText('LOCAL_ENV.USERNAME');
      await expect(restoredWindow.locator('.dialog-message')).toContainText('LOCAL_ENV.PASSWORD');
      await expect(restoredWindow.locator('.dialog-message')).toContainText('LOCAL_ENV.ROLE');

      const settingsWindowPromise = electronApp.waitForEvent("window", {
        predicate: async (candidate) => {
          try {
            return candidate.url().includes("#/settings");
          } catch {
            return false;
          }
        },
      });
      await restoredWindow.getByRole("button", { name: "Settings を開く" }).click();
      const settingsWindow = await settingsWindowPromise;
      await settingsWindow.waitForLoadState("domcontentloaded");

      await settingsWindow.getByRole("button", { name: "Add LOCAL_ENV" }).click();
      await settingsWindow.getByLabel("Environment match host").fill("127.0.0.1");
      await settingsWindow.locator('input[aria-label="Environment key 1"]').fill("ORIGIN");
      await settingsWindow.locator('input[aria-label="Environment value 1"]').fill(fixtureSite.origin);

      await settingsWindow.getByRole("button", { name: "Add environment value" }).click();
      await settingsWindow.getByRole("button", { name: "Add environment value" }).click();
      await settingsWindow.getByRole("button", { name: "Add environment value" }).click();

      await settingsWindow.locator('input[aria-label="Environment key 2"]').fill("USERNAME");
      await settingsWindow.locator('input[aria-label="Environment value 2"]').fill("env-user");
      await settingsWindow.locator('input[aria-label="Environment key 3"]').fill("PASSWORD");
      await settingsWindow.locator('input[aria-label="Environment value 3"]').fill("env-pass");
      await settingsWindow.locator('input[aria-label="Environment key 4"]').fill("ROLE");
      await settingsWindow.locator('input[aria-label="Environment value 4"]').fill("admin");

      await settingsWindow.waitForTimeout(500);
      await restoredWindow.getByRole("button", { name: "閉じる", exact: true }).click();
      await restoredWindow.getByRole("button", { name: /Run/ }).click();
      await expect(restoredWindow.locator(".step-order-passed")).toHaveCount(10);
    } finally {
      await secondSession.close();
    }
  } finally {
    await firstSession.close().catch(() => {});
    await fixtureSite.close();
  }
});