import { test, expect } from "@playwright/test";
import { launchStorywright, startFixtureSite } from "./helpers/app";

test("saved story runs end-to-end against a fixture site", async () => {
  const fixtureSite = await startFixtureSite();
  const session = await launchStorywright({
    urlHistory: {
      lastBaseUrl: fixtureSite.origin,
      history: [fixtureSite.origin],
    },
    stories: {
      schemaVersion: 1,
      stories: {
        "story-checkout": {
          id: "story-checkout",
          title: "Checkout Story",
          baseUrl: fixtureSite.origin,
          metadata: { createdAt: Date.now() },
          steps: [
            {
              id: "step-1",
              order: 1,
              action: "navigate",
              target: `${fixtureSite.origin}/item`,
              value: "",
              description: "",
            },
            {
              id: "step-2",
              order: 2,
              action: "click",
              target: 'text="カートに入れる"',
              value: "",
              description: "",
            },
            {
              id: "step-3",
              order: 3,
              action: "assert",
              target: "#status",
              value: "カート追加完了",
              description: "",
            },
          ],
        },
      },
    },
  });

  try {
    const { mainWindow } = session;

    await mainWindow.getByRole("button", { name: /Checkout Story/ }).click();
    await mainWindow.getByRole("button", { name: /Run/ }).click();

    await expect(mainWindow.locator(".step-order-passed")).toHaveCount(3);
    await expect(mainWindow.getByRole("button", { name: /Run/ })).toBeVisible();
  } finally {
    await session.close();
    await fixtureSite.close();
  }
});