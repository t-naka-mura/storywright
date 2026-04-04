import { test, expect } from "@playwright/test";
import { getPreviewBounds, launchStorywright } from "./helpers/app";

test("URL history dropdown stays visible and pushes native preview bounds", async () => {
  const session = await launchStorywright({
    urlHistory: {
      lastBaseUrl: "https://tn202204.base0.info",
      history: [
        "https://tn202204.base0.info",
        "https://admin.stgthebase.com",
        "https://example.com",
      ],
    },
  });

  try {
    const { mainWindow } = session;
    const input = mainWindow.getByPlaceholder("https://example.com");

    await expect(input).toHaveValue("https://tn202204.base0.info");

    await mainWindow.waitForFunction(async () => {
      const bounds = await window.storywright.testGetPreviewBounds?.();
      return !!bounds && bounds.width > 0 && bounds.height > 0;
    });

    const beforeBounds = await getPreviewBounds(mainWindow);
    await input.click();

    await expect(mainWindow.getByRole("button", { name: "https://tn202204.base0.info" })).toBeVisible();
    const afterBounds = await getPreviewBounds(mainWindow);

    expect(beforeBounds).not.toBeNull();
    expect(afterBounds).not.toBeNull();
    expect(afterBounds!.y).toBeGreaterThan(beforeBounds!.y);
    expect(afterBounds!.height).toBeLessThan(beforeBounds!.height);
  } finally {
    await session.close();
  }
});