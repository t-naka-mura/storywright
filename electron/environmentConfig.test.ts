import { describe, expect, it } from "vitest";
import {
  getActiveEnvironmentDomain,
  inspectEnvironmentSource,
  normalizeEnvironmentSettings,
  resolveEnvironmentWithSettings,
} from "./environmentConfig";

describe("normalizeEnvironmentSettings", () => {
  it("domain を正規化して activeDomainId を決める", () => {
    expect(normalizeEnvironmentSettings({
      domains: [
        { id: " jp ", name: " Japan ", values: [{ key: " TOKEN ", value: "jp-token" }] },
      ],
      activeDomainId: "jp",
    })).toEqual({
      domains: [{ id: "jp", name: "Japan", values: [{ key: "TOKEN", value: "jp-token" }] }],
      activeDomainId: "jp",
    });
  });
});

describe("getActiveEnvironmentDomain", () => {
  it("activeDomainId に対応する domain を返す", () => {
    expect(getActiveEnvironmentDomain({
      domains: [
        { id: "jp", name: "Japan", values: [{ key: "TOKEN", value: "jp-token" }] },
        { id: "us", name: "US", values: [{ key: "TOKEN", value: "us-token" }] },
      ],
      activeDomainId: "us",
    })).toEqual({
      id: "us",
      name: "US",
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
      { domains: [{ id: "default", name: "Default", values: [{ key: "HOST", value: "domain.example.com" }, { key: "TOKEN", value: "domain-token" }, { key: "MODE", value: "staging" }] }] },
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
          { id: "jp", name: "Japan", values: [{ key: "TOKEN", value: "jp-token" }] },
          { id: "us", name: "US", values: [{ key: "TOKEN", value: "us-token" }, { key: "REGION", value: "us-east-1" }] },
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
        { domains: [{ id: "default", name: "Default", values: [{ key: "API_KEY", value: "secret" }, { key: "TOKEN", value: "domain-token" }] }] },
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
        { domains: [{ id: "default", name: "Default", values: [{ key: "API_KEY", value: "secret" }, { key: "REGION", value: "ap-northeast-1" }] }] },
      ),
    ).toEqual({
      mode: "domain-values",
      loadedVariableCount: 3,
      inlineValueCount: 2,
    });
  });
});