import { describe, expect, it } from "vitest";
import { resolveEnvPlaceholders, resolveStoryEnvironmentVariables } from "./resolveEnvPlaceholders";

describe("resolveEnvPlaceholders", () => {
  it("単一の環境変数プレースホルダを解決する", () => {
    expect(resolveEnvPlaceholders("{{LOCAL_ENV.USERNAME}}", { USERNAME: "admin" })).toBe("admin");
  });

  it("複数の環境変数が混在する文字列を解決する", () => {
    expect(
      resolveEnvPlaceholders("https://{{LOCAL_ENV.HOST}}/api/{{LOCAL_ENV.VERSION}}", {
        HOST: "example.com",
        VERSION: "v1",
      }),
    ).toBe("https://example.com/api/v1");
  });

  it("未定義の環境変数参照はエラーにする", () => {
    expect(() => resolveEnvPlaceholders("{{LOCAL_ENV.PASSWORD}}", {})).toThrow(
      "Environment variable is not defined: PASSWORD",
    );
  });
});

describe("resolveStoryEnvironmentVariables", () => {
  it("step の target と value と baseUrl をまとめて解決する", () => {
    const resolved = resolveStoryEnvironmentVariables(
      {
        id: "story-1",
        title: "Login Story",
        baseUrl: "https://{{LOCAL_ENV.HOST}}",
        steps: [
          {
            order: 1,
            action: "navigate",
            target: "/{{LOCAL_ENV.PATH}}",
            value: "",
          },
          {
            order: 2,
            action: "type",
            target: "#username-{{LOCAL_ENV.SUFFIX}}",
            value: "{{LOCAL_ENV.USERNAME}}",
          },
        ],
      },
      {
        HOST: "example.com",
        PATH: "login",
        SUFFIX: "input",
        USERNAME: "admin",
      },
    );

    expect(resolved.baseUrl).toBe("https://example.com");
    expect(resolved.steps[0].target).toBe("/login");
    expect(resolved.steps[1].target).toBe("#username-input");
    expect(resolved.steps[1].value).toBe("admin");
  });
});