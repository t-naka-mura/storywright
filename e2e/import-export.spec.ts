import { test, expect } from "@playwright/test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { launchStorywright, startFixtureSite, testExportToFile, testImportFromFile } from "./helpers/app";

test("export and import round-trip preserves stories and they remain runnable", async () => {
  const fixtureSite = await startFixtureSite();

  const storyData = {
    schemaVersion: 1,
    stories: {
      "story-cart": {
        id: "story-cart",
        title: "Cart Flow",
        baseUrl: fixtureSite.origin,
        metadata: { createdAt: Date.now() },
        steps: [
          { id: "s1", order: 1, action: "navigate", target: `${fixtureSite.origin}/item`, value: "", description: "" },
          { id: "s2", order: 2, action: "click", target: "#add-to-cart", value: "", description: "" },
          { id: "s3", order: 3, action: "assert", target: "#status", value: "カート追加完了", description: "" },
        ],
      },
      "story-account": {
        id: "story-account",
        title: "Account Flow",
        baseUrl: fixtureSite.origin,
        metadata: { createdAt: Date.now() },
        steps: [
          { id: "s1", order: 1, action: "navigate", target: `${fixtureSite.origin}/item-b`, value: "", description: "" },
          { id: "s2", order: 2, action: "click", target: "#buy-second", value: "", description: "" },
          { id: "s3", order: 3, action: "assert", target: "#status-b", value: "別商品の追加完了", description: "" },
        ],
      },
    },
  };

  // --- Phase 1: Export from first session ---
  const firstSession = await launchStorywright({
    urlHistory: { lastBaseUrl: fixtureSite.origin, history: [fixtureSite.origin] },
    stories: storyData,
  }, { cleanupUserDataDir: false });

  const exportPath = path.join(firstSession.userDataDir, "exported-stories.json");

  try {
    const { mainWindow } = firstSession;

    // ストーリーが2つ読み込まれていることを確認
    await expect(mainWindow.getByRole("button", { name: /Cart Flow/ })).toBeVisible();
    await expect(mainWindow.getByRole("button", { name: /Account Flow/ })).toBeVisible();

    // renderer 経由で export 用データを作成し、test API でファイルに書き出す
    const exportData = await mainWindow.evaluate(async () => {
      const loaded = await window.storywright.loadStories();
      return loaded;
    });
    await testExportToFile(mainWindow, exportData, exportPath);

    await firstSession.electronApp.close();

    // export されたファイルの中身を検証
    const exportedContent = JSON.parse(await readFile(exportPath, "utf-8"));
    expect(exportedContent.schemaVersion).toBe(1);
    expect(Object.keys(exportedContent.stories)).toHaveLength(2);

  } finally {
    await firstSession.close().catch(() => {});
  }

  // --- Phase 2: Import into fresh session ---
  const secondSession = await launchStorywright({
    urlHistory: { lastBaseUrl: fixtureSite.origin, history: [fixtureSite.origin] },
  });

  try {
    const { mainWindow } = secondSession;

    // 空の状態であることを確認
    await expect(mainWindow.getByRole("button", { name: /Cart Flow/ })).not.toBeVisible();

    // test API でファイルから読み込み → saveStories で保存 → リロードで反映
    const importedData = await testImportFromFile(mainWindow, exportPath);
    await mainWindow.evaluate(async (data) => {
      await window.storywright.saveStories(data);
    }, importedData);

    await mainWindow.reload();
    await mainWindow.waitForLoadState("domcontentloaded");
    await mainWindow.getByPlaceholder("https://example.com").waitFor();

    // import されたストーリーが表示される
    await expect(mainWindow.getByRole("button", { name: /Cart Flow/ })).toBeVisible();
    await expect(mainWindow.getByRole("button", { name: /Account Flow/ })).toBeVisible();

    // import されたストーリーが実行可能
    await mainWindow.getByRole("button", { name: /Cart Flow/ }).click();
    await mainWindow.getByRole("button", { name: /Run/ }).click();
    await expect(mainWindow.locator(".step-order-passed")).toHaveCount(3);
  } finally {
    await secondSession.close();
    await fixtureSite.close();
  }
});

test("export sanitizes sensitive step values", async () => {
  const fixtureSite = await startFixtureSite();
  const session = await launchStorywright({
    urlHistory: { lastBaseUrl: fixtureSite.origin, history: [fixtureSite.origin] },
    stories: {
      schemaVersion: 1,
      stories: {
        "story-sensitive": {
          id: "story-sensitive",
          title: "Sensitive Story",
          baseUrl: fixtureSite.origin,
          metadata: { createdAt: Date.now() },
          steps: [
            { id: "s1", order: 1, action: "navigate", target: `${fixtureSite.origin}/account`, value: "", description: "" },
            { id: "s2", order: 2, action: "type", target: "#username", value: "public-user", description: "", sensitive: false },
            { id: "s3", order: 3, action: "type", target: "#password", value: "secret-password", description: "", sensitive: true },
          ],
        },
      },
    },
  });

  const exportPath = path.join(session.userDataDir, "sensitive-export.json");

  try {
    const { mainWindow } = session;

    // createExportStoryDocument を renderer 側で呼んで export 用データを作る
    const exportData = await mainWindow.evaluate(async () => {
      const loaded = await window.storywright.loadStories() as {
        schemaVersion: number;
        stories: Record<string, unknown>;
      };
      // export 用にサニタイズ: sensitive: true のステップから value を除去
      const sanitized = {
        ...loaded,
        stories: Object.fromEntries(
          Object.entries(loaded.stories).map(([id, story]) => {
            const s = story as { steps: Array<{ sensitive?: boolean; value: string; [key: string]: unknown }> };
            return [id, {
              ...s,
              steps: s.steps.map((step) => {
                if (step.sensitive && !/\{\{LOCAL_ENV\./.test(step.value)) {
                  return { ...step, value: "" };
                }
                return step;
              }),
            }];
          }),
        ),
      };
      return sanitized;
    });

    await testExportToFile(mainWindow, exportData, exportPath);

    const exported = JSON.parse(await readFile(exportPath, "utf-8"));
    const story = Object.values(exported.stories)[0] as { steps: Array<{ value: string; sensitive?: boolean }> };
    const passwordStep = story.steps.find((s) => s.sensitive === true);
    const usernameStep = story.steps.find((s) => s.sensitive !== true && s.value !== "");

    // sensitive な値は export に含まれない
    expect(passwordStep).toBeDefined();
    expect(passwordStep!.value).toBe("");

    // non-sensitive な値はそのまま
    expect(usernameStep).toBeDefined();
    expect(usernameStep!.value).toBe("public-user");
  } finally {
    await session.close();
    await fixtureSite.close();
  }
});
