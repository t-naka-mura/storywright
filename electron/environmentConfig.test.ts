import { describe, expect, it } from "vitest";
import {
  inspectEnvironmentSource,
  normalizeEnvironmentSettings,
  resolveEnvironmentWithSettings,
} from "./environmentConfig";

describe("normalizeEnvironmentSettings", () => {
  it("空文字の envFilePath を除去する", () => {
    expect(normalizeEnvironmentSettings({ envFilePath: "  " })).toEqual({});
  });

  it("前後の空白を取り除く", () => {
    expect(normalizeEnvironmentSettings({ envFilePath: "  /tmp/.env  " })).toEqual({ envFilePaths: ["/tmp/.env"] });
  });

  it("複数 path を正規化して重複を除去する", () => {
    expect(normalizeEnvironmentSettings({ envFilePaths: [" /tmp/.env ", "", "/tmp/.env.local", "/tmp/.env" ] })).toEqual({
      envFilePaths: ["/tmp/.env", "/tmp/.env.local"],
    });
  });
});

describe("resolveEnvironmentWithSettings", () => {
  it("envFilePath がなければ process env 相当を返す", () => {
    expect(resolveEnvironmentWithSettings({ HOST: "example.com" }, {})).toEqual({ HOST: "example.com" });
  });

  it(".env の値を process env より優先する", () => {
    const resolved = resolveEnvironmentWithSettings(
      { HOST: "process.example.com", TOKEN: "process-token" },
      { envFilePaths: ["/tmp/.env"] },
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
        { envFilePaths: ["/missing/.env"] },
        () => {
          throw new Error("ENOENT");
        },
      ),
    ).toThrow("Failed to load .env file /missing/.env: ENOENT");
  });

  it("後ろの .env が前の .env を上書きする", () => {
    const resolved = resolveEnvironmentWithSettings(
      { HOST: "process.example.com", TOKEN: "process-token" },
      { envFilePaths: ["/tmp/.env", "/tmp/.env.local"] },
      (path) => {
        if (path === "/tmp/.env") {
          return "HOST=base.example.com\nTOKEN=base-token\n";
        }
        return "TOKEN=local-token\nFEATURE=on\n";
      },
    );

    expect(resolved).toEqual({
      HOST: "base.example.com",
      TOKEN: "local-token",
      FEATURE: "on",
    });
  });
});

describe("inspectEnvironmentSource", () => {
  it("process.env only の状態を返す", () => {
    expect(inspectEnvironmentSource({ HOST: "example.com", TOKEN: "token" }, {})).toEqual({
      mode: "process-env",
      loadedVariableCount: 2,
      loadedFileCount: 0,
    });
  });

  it(".env 読み込み成功時は env-files 状態を返す", () => {
    expect(
      inspectEnvironmentSource(
        { HOST: "process.example.com" },
        { envFilePaths: ["/tmp/.env", "/tmp/.env.local"] },
        (path) => path === "/tmp/.env" ? "HOST=file.example.com\n" : "TOKEN=file-token",
      ),
    ).toEqual({
      mode: "env-files",
      envFilePaths: ["/tmp/.env", "/tmp/.env.local"],
      loadedVariableCount: 2,
      loadedFileCount: 2,
    });
  });

  it("旧 envFilePath も互換で扱う", () => {
    expect(
      inspectEnvironmentSource(
        { HOST: "process.example.com" },
        { envFilePath: "/tmp/.env" },
        () => "HOST=file.example.com\nTOKEN=file-token",
      ),
    ).toEqual({
      mode: "env-files",
      envFilePaths: ["/tmp/.env"],
      loadedVariableCount: 2,
      loadedFileCount: 1,
    });
  });

  it(".env 読み込み失敗時は error を返す", () => {
    expect(
      inspectEnvironmentSource(
        {},
        { envFilePaths: ["/missing/.env"] },
        () => {
          throw new Error("ENOENT");
        },
      ),
    ).toEqual({
      mode: "env-files",
      envFilePaths: ["/missing/.env"],
      loadedVariableCount: 0,
      loadedFileCount: 0,
      error: "Failed to load .env file /missing/.env: ENOENT",
    });
  });
});