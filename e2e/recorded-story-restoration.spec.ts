import { expect, test } from "@playwright/test";
import { clickInPreview, fillInPreview, getActivePreviewUrl, launchStorywright, loadPreviewUrl, readUserDataJson, selectInPreview, startFixtureSite, waitForRecordedStepCount } from "./helpers/app";

test("recorded stories survive relaunch and sensitive values stay out of stories.json", async () => {
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

    await fillInPreview(mainWindow, "#username", "alice");
    await fillInPreview(mainWindow, "#password", "pw-1234");
    await selectInPreview(mainWindow, "#role", "editor");
    await clickInPreview(mainWindow, "#submit-account");
    await expect.poll(async () => await getActivePreviewUrl(mainWindow)).toContain("/account/confirm");

    await mainWindow.getByRole("button", { name: /Assert/ }).click();
    await clickInPreview(mainWindow, "#submitted-role");
    await mainWindow.getByRole("button", { name: /Assert/ }).click();
    await clickInPreview(mainWindow, "#submitted-user");
    await waitForRecordedStepCount(mainWindow, 9);

    await mainWindow.getByRole("button", { name: /Stop/ }).click();
    await expect(mainWindow.locator(".step-item")).toHaveCount(9);
    await expect(mainWindow.getByText("••••••")).toBeVisible();

    await firstSession.electronApp.close();

    const persistedStories = await readUserDataJson<{ stories: Record<string, { steps: Array<Record<string, unknown>> }> }>(
      firstSession.userDataDir,
      "stories.json",
    );
    const persistedSecrets = await readUserDataJson<Record<string, string>>(firstSession.userDataDir, "storySecrets.json");
    const recordedStory = Object.values(persistedStories.stories)[0];
    const passwordStep = recordedStory.steps.find((step) => step.sensitive === true);

    expect(passwordStep).toBeDefined();
    expect(passwordStep).not.toHaveProperty("value", "pw-1234");
    expect(passwordStep).toHaveProperty("valueRef");
    expect(Object.values(persistedSecrets)).toHaveLength(1);
    expect(Object.values(persistedSecrets)[0]).not.toBe("pw-1234");

    const secondSession = await launchStorywright({}, {
      userDataDir: firstSession.userDataDir,
      cleanupUserDataDir: true,
    });

    try {
      const restoredWindow = secondSession.mainWindow;
      await expect(restoredWindow.getByRole("button", { name: /録画/ })).toBeVisible();
      await restoredWindow.getByRole("button", { name: /録画/ }).click();
      const restoredStepCount = await restoredWindow.locator(".step-item").count();
      expect(restoredStepCount).toBeGreaterThanOrEqual(8);
      await expect(restoredWindow.getByText("••••••")).toBeVisible();

      await restoredWindow.getByRole("button", { name: /Run/ }).click();
      await expect(restoredWindow.locator(".step-order-passed")).toHaveCount(restoredStepCount);
    } finally {
      await secondSession.close();
    }
  } finally {
    await firstSession.close().catch(() => {});
    await fixtureSite.close();
  }
});