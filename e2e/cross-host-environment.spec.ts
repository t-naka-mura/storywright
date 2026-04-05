import { test, expect } from "@playwright/test";
import { launchStorywright, startFixtureSite, openSettingsWindow } from "./helpers/app";

/**
 * 異なる baseUrl のストーリーが、ホスト名マッチで別々の環境変数ドメインを使うことを検証。
 *
 * fixture site は 127.0.0.1:PORT で起動するが、localhost:PORT でも同じサーバーにアクセスできる。
 * - ストーリーA: baseUrl = http://127.0.0.1:PORT → ドメイン "127.0.0.1" の GREETING を使う
 * - ストーリーB: baseUrl = http://localhost:PORT → ドメイン "localhost" の GREETING を使う
 *
 * 各ストーリーの navigate target に {{LOCAL_ENV.GREETING}} を埋め込み、
 * resolve された値が assert で一致することで、ホスト名マッチが正しく機能していることを証明する。
 */
test("stories with different baseUrls resolve environment variables from matching hostname domains", async () => {
  const fixtureSite = await startFixtureSite();
  // fixture site の port を取得して localhost でもアクセスできるようにする
  const port = new URL(fixtureSite.origin).port;
  const localhostOrigin = `http://localhost:${port}`;

  const session = await launchStorywright({
    urlHistory: {
      lastBaseUrl: fixtureSite.origin,
      history: [fixtureSite.origin, localhostOrigin],
    },
    stories: {
      schemaVersion: 1,
      stories: {
        "story-ip": {
          id: "story-ip",
          title: "IP Host Story",
          baseUrl: fixtureSite.origin, // http://127.0.0.1:PORT
          metadata: { createdAt: Date.now() },
          steps: [
            {
              id: "s1", order: 1, action: "navigate",
              target: `${fixtureSite.origin}/account/confirm?user={{LOCAL_ENV.GREETING}}&role=viewer`,
              value: "", description: "",
            },
            {
              id: "s2", order: 2, action: "assert",
              target: "#submitted-user",
              value: "hello-from-ip",
              description: "",
            },
          ],
        },
        "story-localhost": {
          id: "story-localhost",
          title: "Localhost Story",
          baseUrl: localhostOrigin, // http://localhost:PORT
          metadata: { createdAt: Date.now() },
          steps: [
            {
              id: "s1", order: 1, action: "navigate",
              target: `${localhostOrigin}/account/confirm?user={{LOCAL_ENV.GREETING}}&role=viewer`,
              value: "", description: "",
            },
            {
              id: "s2", order: 2, action: "assert",
              target: "#submitted-user",
              value: "hello-from-localhost",
              description: "",
            },
          ],
        },
      },
    },
    // Settings に2つのドメインを事前設定
    environment: {
      domains: [
        {
          id: "domain-ip",
          name: "IP Domain",
          matchHost: "127.0.0.1",
          values: [{ key: "GREETING", value: "hello-from-ip" }],
        },
        {
          id: "domain-localhost",
          name: "Localhost Domain",
          matchHost: "localhost",
          values: [{ key: "GREETING", value: "hello-from-localhost" }],
        },
      ],
      activeDomainId: "domain-ip",
    },
  });

  try {
    const { mainWindow } = session;

    // --- ストーリーA: 127.0.0.1 → "hello-from-ip" ---
    await mainWindow.getByRole("button", { name: /IP Host Story/ }).click();
    await mainWindow.getByRole("button", { name: /Run/ }).click();
    await expect(mainWindow.locator(".step-order-passed")).toHaveCount(2, { timeout: 15000 });

    // --- ストーリーB: localhost → "hello-from-localhost" ---
    await mainWindow.locator("button.panel-back").click();
    await mainWindow.getByRole("button", { name: /Localhost Story/ }).click();
    await mainWindow.getByRole("button", { name: /Run/ }).click();
    await expect(mainWindow.locator(".step-order-passed")).toHaveCount(2, { timeout: 15000 });
  } finally {
    await session.close();
    await fixtureSite.close();
  }
});

/**
 * ホスト名が一致しない場合でもプレースホルダーを使っていれば、
 * 環境変数不足エラーが表示されることを検証。
 */
test("story with env placeholders shows missing env error when no domain matches", async () => {
  const fixtureSite = await startFixtureSite();

  const session = await launchStorywright({
    urlHistory: {
      lastBaseUrl: fixtureSite.origin,
      history: [fixtureSite.origin],
    },
    stories: {
      schemaVersion: 1,
      stories: {
        "story-no-match": {
          id: "story-no-match",
          title: "No Match Story",
          baseUrl: fixtureSite.origin, // 127.0.0.1
          metadata: { createdAt: Date.now() },
          steps: [
            {
              id: "s1", order: 1, action: "navigate",
              target: `${fixtureSite.origin}/account/confirm?user={{LOCAL_ENV.TOKEN}}&role=viewer`,
              value: "", description: "",
            },
          ],
        },
      },
    },
    // ドメインは "example.com" のみ → 127.0.0.1 にはマッチしない
    environment: {
      domains: [
        {
          id: "domain-other",
          name: "Other Domain",
          matchHost: "example.com",
          values: [{ key: "TOKEN", value: "some-token" }],
        },
      ],
      activeDomainId: "domain-other",
    },
  });

  try {
    const { mainWindow } = session;
    await mainWindow.getByRole("button", { name: /No Match Story/ }).click();
    await mainWindow.getByRole("button", { name: /Run/ }).click();

    // 環境変数不足エラーが表示される（renderer 側の事前チェック）
    await expect(mainWindow.locator(".dialog-title")).toHaveText("環境変数が不足しています");
    await expect(mainWindow.locator(".dialog-message")).toContainText("LOCAL_ENV.TOKEN");
  } finally {
    await session.close();
    await fixtureSite.close();
  }
});

/**
 * プレースホルダーを使っていない Story は、ホスト名が一致しなくても正常に実行できることを検証。
 */
test("story without env placeholders runs successfully even when domain does not match", async () => {
  const fixtureSite = await startFixtureSite();

  const session = await launchStorywright({
    urlHistory: {
      lastBaseUrl: fixtureSite.origin,
      history: [fixtureSite.origin],
    },
    stories: {
      schemaVersion: 1,
      stories: {
        "story-plain": {
          id: "story-plain",
          title: "Plain Story",
          baseUrl: fixtureSite.origin,
          metadata: { createdAt: Date.now() },
          steps: [
            {
              id: "s1", order: 1, action: "navigate",
              target: `${fixtureSite.origin}/`,
              value: "", description: "",
            },
            {
              id: "s2", order: 2, action: "assert",
              target: "h1",
              value: "Test App",
              description: "",
            },
          ],
        },
      },
    },
    // ドメインは "example.com" のみ → fixtureSite にはマッチしないが、プレースホルダーなしなので問題ない
    environment: {
      domains: [
        {
          id: "domain-other",
          name: "Other Domain",
          matchHost: "example.com",
          values: [{ key: "TOKEN", value: "some-token" }],
        },
      ],
      activeDomainId: "domain-other",
    },
  });

  try {
    const { mainWindow } = session;
    await mainWindow.getByRole("button", { name: /Plain Story/ }).click();
    await mainWindow.getByRole("button", { name: /Run/ }).click();
    await expect(mainWindow.locator(".step-order-passed")).toHaveCount(2, { timeout: 15000 });
  } finally {
    await session.close();
    await fixtureSite.close();
  }
});
