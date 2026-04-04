import { describe, expect, it } from "vitest";
import {
  getActiveEnvironmentDomain,
  getMatchingEnvironmentDomain,
  inspectEnvironmentSource,
  normalizeEnvironmentSettings,
  resolveEnvironmentWithSettings,
} from "./environmentConfig";

describe("normalizeEnvironmentSettings", () => {
  it("domain を正規化して activeDomainId を決める", () => {
    expect(normalizeEnvironmentSettings({
      domains: [
        { id: " jp ", name: " Japan ", matchHost: " example.jp ", values: [{ key: " TOKEN ", value: "jp-token" }] },
      ],
      activeDomainId: "jp",
    })).toEqual({
      domains: [{ id: "jp", name: "Japan", matchHost: "example.jp", values: [{ key: "TOKEN", value: "jp-token" }] }],
      activeDomainId: "jp",
    });
  });

  it("旧自動ラベルの Domain / Environment を LOCAL_ENV に移行する", () => {
    expect(normalizeEnvironmentSettings({
      domains: [
        { id: "one", name: "Domain 1", matchHost: "example.jp", values: [] },
        { id: "two", name: "Environment 2", matchHost: "example.com", values: [] },
      ],
      activeDomainId: "one",
    })).toEqual({
      domains: [
        { id: "one", name: "LOCAL_ENV", matchHost: "example.jp", values: [] },
        { id: "two", name: "LOCAL_ENV_2", matchHost: "example.com", values: [] },
      ],
      activeDomainId: "one",
    });
  });
});

describe("getActiveEnvironmentDomain", () => {
  it("activeDomainId に対応する domain を返す", () => {
    expect(getActiveEnvironmentDomain({
      domains: [
        { id: "jp", name: "Japan", matchHost: "example.jp", values: [{ key: "TOKEN", value: "jp-token" }] },
        { id: "us", name: "US", matchHost: "example.com", values: [{ key: "TOKEN", value: "us-token" }] },
      ],
      activeDomainId: "us",
    })).toEqual({
      id: "us",
      name: "US",
      matchHost: "example.com",
      values: [{ key: "TOKEN", value: "us-token" }],
    });
  });
});

describe("getMatchingEnvironmentDomain", () => {
  it("URL の hostname 完全一致で domain を返す", () => {
    expect(getMatchingEnvironmentDomain({
      domains: [
        { id: "jp", name: "Japan", matchHost: "example.jp", values: [{ key: "TOKEN", value: "jp-token" }] },
        { id: "us", name: "US", matchHost: "example.com", values: [{ key: "TOKEN", value: "us-token" }] },
      ],
      activeDomainId: "jp",
    }, "https://example.com/login")).toEqual({
      id: "us",
      name: "US",
      matchHost: "example.com",
      values: [{ key: "TOKEN", value: "us-token" }],
    });
  });
});

describe("resolveEnvironmentWithSettings", () => {
  it("active domain がなければ process env 相当を返す", () => {
    expect(resolveEnvironmentWithSettings({ HOST: "example.com" }, {})).toEqual({ HOST: "example.com" });
  });

  it("active domain の values が process env より優先する", () => {
    const resolved = resolveEnvironmentWithSettings(
      { HOST: "process.example.com", TOKEN: "process-token" },
      { domains: [{ id: "default", name: "Default", matchHost: "example.com", values: [{ key: "HOST", value: "domain.example.com" }, { key: "TOKEN", value: "domain-token" }, { key: "MODE", value: "staging" }] }] },
    );

    expect(resolved).toEqual({
      HOST: "domain.example.com",
      TOKEN: "domain-token",
      MODE: "staging",
    });
  });

  it("activeDomainId の domain が使われる", () => {
    const resolved = resolveEnvironmentWithSettings(
      { HOST: "process.example.com", TOKEN: "process-token" },
      {
        domains: [
          { id: "jp", name: "Japan", matchHost: "example.jp", values: [{ key: "TOKEN", value: "jp-token" }] },
          { id: "us", name: "US", matchHost: "example.com", values: [{ key: "TOKEN", value: "us-token" }, { key: "REGION", value: "us-east-1" }] },
        ],
        activeDomainId: "us",
      },
    );

    expect(resolved).toEqual({
      HOST: "process.example.com",
      TOKEN: "us-token",
      REGION: "us-east-1",
    });
  });
});

describe("inspectEnvironmentSource", () => {
  it("process.env only の状態を返す", () => {
    expect(inspectEnvironmentSource({ HOST: "example.com", TOKEN: "token" }, {})).toEqual({
      mode: "process-env",
      loadedVariableCount: 2,
      inlineValueCount: 0,
    });
  });

  it("domain values があれば domain-values 状態を返す", () => {
    expect(
      inspectEnvironmentSource(
        { HOST: "process.example.com" },
        { domains: [{ id: "default", name: "Default", matchHost: "example.com", values: [{ key: "API_KEY", value: "secret" }, { key: "TOKEN", value: "domain-token" }] }] },
      ),
    ).toEqual({
      mode: "domain-values",
      loadedVariableCount: 3,
      inlineValueCount: 2,
    });
  });

  it("inline value 数を status に含める", () => {
    expect(
      inspectEnvironmentSource(
        { HOST: "process.example.com" },
        { domains: [{ id: "default", name: "Default", matchHost: "example.com", values: [{ key: "API_KEY", value: "secret" }, { key: "REGION", value: "ap-northeast-1" }] }] },
      ),
    ).toEqual({
      mode: "domain-values",
      loadedVariableCount: 3,
      inlineValueCount: 2,
    });
  });
});