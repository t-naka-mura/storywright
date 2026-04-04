import { test, expect } from "@playwright/test";
import { launchStorywright, openSettingsWindow } from "./helpers/app";

test("LOCAL_ENV settings persist across app relaunch", async () => {
  const session = await launchStorywright({}, { cleanupUserDataDir: false });

  try {
    const settingsWindow = await openSettingsWindow(session.electronApp, session.mainWindow);

    await settingsWindow.getByRole("button", { name: "Add LOCAL_ENV" }).click();
    await settingsWindow.getByLabel("Environment match host").fill("shop.example.com");
    await settingsWindow.locator('input[aria-label="Environment key 1"]').fill("API_KEY");
    await settingsWindow.locator('input[aria-label="Environment value 1"]').fill("secret-value");

    await settingsWindow.waitForTimeout(500);

    await session.electronApp.close();

    const relaunched = await launchStorywright({}, {
      userDataDir: session.userDataDir,
      cleanupUserDataDir: true,
    });

    try {
      const settingsWindowRelaunched = await openSettingsWindow(relaunched.electronApp, relaunched.mainWindow);
      await expect(settingsWindowRelaunched.getByLabel("Environment match host")).toHaveValue("shop.example.com");
      await expect(settingsWindowRelaunched.locator('input[aria-label="Environment key 1"]')).toHaveValue("API_KEY");
      await expect(settingsWindowRelaunched.locator('input[aria-label="Environment value 1"]')).toHaveValue("secret-value");
    } finally {
      await relaunched.close();
    }
  } finally {
    await session.close().catch(() => {});
  }
});