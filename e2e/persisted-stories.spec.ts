import { test, expect } from "@playwright/test";
import { launchStorywright, persistStories, startFixtureSite } from "./helpers/app";

test("persisted recorded stories are restored after relaunch and only the selected story runs", async () => {
  const fixtureSite = await startFixtureSite();
  const firstSession = await launchStorywright({
    urlHistory: {
      lastBaseUrl: fixtureSite.origin,
      history: [fixtureSite.origin],
    },
  }, { cleanupUserDataDir: false });

  try {
    await persistStories(firstSession.mainWindow, [
      {
        id: "recorded-story-a",
        title: "Recorded Story A",
        baseUrl: fixtureSite.origin,
        metadata: { createdAt: Date.now() },
        steps: [
          {
            id: "a-step-1",
            order: 1,
            action: "navigate",
            target: `${fixtureSite.origin}/item`,
            value: "",
            description: "",
          },
          {
            id: "a-step-2",
            order: 2,
            action: "click",
            target: 'text="カートに入れる"',
            value: "",
            description: "",
          },
          {
            id: "a-step-3",
            order: 3,
            action: "assert",
            target: "#status",
            value: "カート追加完了",
            description: "",
          },
        ],
      },
      {
        id: "recorded-story-b",
        title: "Recorded Story B",
        baseUrl: fixtureSite.origin,
        metadata: { createdAt: Date.now() + 1 },
        steps: [
          {
            id: "b-step-1",
            order: 1,
            action: "navigate",
            target: `${fixtureSite.origin}/item-b`,
            value: "",
            description: "",
          },
          {
            id: "b-step-2",
            order: 2,
            action: "click",
            target: 'text="別商品を追加"',
            value: "",
            description: "",
          },
          {
            id: "b-step-3",
            order: 3,
            action: "assert",
            target: "#status-b",
            value: "別商品の追加完了",
            description: "",
          },
        ],
      },
    ]);

    await firstSession.electronApp.close();

    const secondSession = await launchStorywright({}, {
      userDataDir: firstSession.userDataDir,
      cleanupUserDataDir: true,
    });

    try {
      const { mainWindow } = secondSession;

      await expect(mainWindow.getByRole("button", { name: /Recorded Story A/ })).toBeVisible();
      await expect(mainWindow.getByRole("button", { name: /Recorded Story B/ })).toBeVisible();

      await mainWindow.getByRole("button", { name: /Recorded Story B/ }).click();
      await mainWindow.getByRole("button", { name: /Run/ }).click();

      await expect(mainWindow.locator(".step-order-passed")).toHaveCount(3);
      await mainWindow.locator(".panel-back").click();
      await expect(mainWindow.getByRole("button", { name: /Recorded Story A/ })).toBeVisible();

      const storyBItem = mainWindow.locator(".standalone-story-item", {
        has: mainWindow.getByText("Recorded Story B"),
      });
      const storyAItem = mainWindow.locator(".standalone-story-item", {
        has: mainWindow.getByText("Recorded Story A"),
      });

      await expect(storyBItem.locator(".story-badge-passed")).toBeVisible();
      await expect(storyAItem.locator(".story-badge")).toHaveCount(0);
    } finally {
      await secondSession.close();
    }
  } finally {
    await firstSession.close().catch(() => {});
    await fixtureSite.close();
  }
});