import { describe, expect, it } from "vitest";
import { normalizeEnvironmentSettings, resolveEnvironmentWithSettings } from "./environmentConfig";

describe("normalizeEnvironmentSettings", () => {
  it("空文字の envFilePath を除去する", () => {
    expect(normalizeEnvironmentSettings({ envFilePath: "  " })).toEqual({});
  });

  it("前後の空白を取り除く", () => {
    expect(normalizeEnvironmentSettings({ envFilePath: "  /tmp/.env  " })).toEqual({ envFilePath: "/tmp/.env" });
  });
});

describe("resolveEnvironmentWithSettings", () => {
  it("envFilePath がなければ process env 相当を返す", () => {
    expect(resolveEnvironmentWithSettings({ HOST: "example.com" }, {})).toEqual({ HOST: "example.com" });
  });

  it(".env の値を process env より優先する", () => {
    const resolved = resolveEnvironmentWithSettings(
      { HOST: "process.example.com", TOKEN: "process-token" },
      { envFilePath: "/tmp/.env" },
      () => "HOST=file.example.com\nTOKEN=file-token\nMODE=staging\n",
    );

    expect(resolved).toEqual({
      HOST: "file.example.com",
      TOKEN: "file-token",
      MODE: "staging",
    });
  });

  it(".env 読み込み失敗時は説明付きエラーにする", () => {
    expect(() =>
      resolveEnvironmentWithSettings(
        {},
        { envFilePath: "/missing/.env" },
        () => {
          throw new Error("ENOENT");
        },
      ),
    ).toThrow("Failed to load .env file: ENOENT");
  });
});