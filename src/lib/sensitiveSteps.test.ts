import { describe, it, expect } from "vitest";
import { transformSensitiveSteps, isSensitiveTarget } from "./sensitiveSteps";

describe("transformSensitiveSteps", () => {
  it("sensitive な値のみ変換する", () => {
    const data = {
      story1: {
        id: "1",
        title: "Test",
        steps: [
          { order: 1, action: "type", target: "#user", value: "admin", sensitive: false },
          { order: 2, action: "type", target: "#pass", value: "secret123", sensitive: true },
          { order: 3, action: "click", target: "#submit", value: "" },
        ],
      },
    };

    const result = transformSensitiveSteps(data, (v) => `encrypted:${v}`) as Record<string, any>;

    expect(result.story1.steps[0].value).toBe("admin");
    expect(result.story1.steps[1].value).toBe("encrypted:secret123");
    expect(result.story1.steps[2].value).toBe("");
  });

  it("sensitive でも value が空なら変換しない", () => {
    const data = {
      story1: {
        steps: [
          { order: 1, action: "type", target: "#pass", value: "", sensitive: true },
        ],
      },
    };

    const result = transformSensitiveSteps(data, (v) => `encrypted:${v}`) as Record<string, any>;
    expect(result.story1.steps[0].value).toBe("");
  });

  it("steps がない story はそのまま返す", () => {
    const data = {
      story1: { id: "1", title: "No steps" },
    };

    const result = transformSensitiveSteps(data, (v) => `enc:${v}`) as Record<string, any>;
    expect(result.story1).toEqual({ id: "1", title: "No steps" });
  });

  it("null/undefined は素通しする", () => {
    expect(transformSensitiveSteps(null, (v) => v)).toBeNull();
    expect(transformSensitiveSteps(undefined, (v) => v)).toBeUndefined();
  });

  it("暗号化→復号で元の値に戻る（ラウンドトリップ）", () => {
    const data = {
      story1: {
        steps: [
          { order: 1, action: "type", target: "#pass", value: "my-password", sensitive: true },
          { order: 2, action: "type", target: "#user", value: "admin" },
        ],
      },
    };

    // シンプルな可逆変換でラウンドトリップテスト
    const encrypt = (v: string) => btoa(v);
    const decrypt = (v: string) => atob(v);

    const encrypted = transformSensitiveSteps(data, encrypt) as Record<string, any>;
    expect(encrypted.story1.steps[0].value).not.toBe("my-password");
    expect(encrypted.story1.steps[1].value).toBe("admin");

    const decrypted = transformSensitiveSteps(encrypted, decrypt) as Record<string, any>;
    expect(decrypted.story1.steps[0].value).toBe("my-password");
    expect(decrypted.story1.steps[1].value).toBe("admin");
  });

  it("複数ストーリーを正しく処理する", () => {
    const data = {
      s1: {
        steps: [{ order: 1, action: "type", target: "#a", value: "pw1", sensitive: true }],
      },
      s2: {
        steps: [{ order: 1, action: "type", target: "#b", value: "pw2", sensitive: true }],
      },
    };

    const result = transformSensitiveSteps(data, (v) => `enc:${v}`) as Record<string, any>;
    expect(result.s1.steps[0].value).toBe("enc:pw1");
    expect(result.s2.steps[0].value).toBe("enc:pw2");
  });

  it("sensitive フラグがない step は変換しない", () => {
    const data = {
      story1: {
        steps: [
          { order: 1, action: "type", target: "#pass", value: "secret123" },
        ],
      },
    };

    const result = transformSensitiveSteps(data, (v) => `enc:${v}`) as Record<string, any>;
    expect(result.story1.steps[0].value).toBe("secret123");
  });
});

describe("isSensitiveTarget", () => {
  it('input[type="password"] を検出する', () => {
    expect(isSensitiveTarget('[type="password"]')).toBe(true);
    expect(isSensitiveTarget("input[type='password']")).toBe(true);
    expect(isSensitiveTarget('[type="password"]:nth-child(1)')).toBe(true);
  });

  it("password 以外の type は検出しない", () => {
    expect(isSensitiveTarget('[type="text"]')).toBe(false);
    expect(isSensitiveTarget('[type="email"]')).toBe(false);
    expect(isSensitiveTarget("#password-field")).toBe(false);
  });

  it("空文字や通常のセレクタは false", () => {
    expect(isSensitiveTarget("")).toBe(false);
    expect(isSensitiveTarget("#login-form")).toBe(false);
    expect(isSensitiveTarget(".password")).toBe(false);
  });
});
