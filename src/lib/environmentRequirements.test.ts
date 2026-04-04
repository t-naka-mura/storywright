import { describe, expect, it } from "vitest";
import type { Story } from "../types";
import {
  collectEnvironmentRequirements,
  createEnvironmentSetupGuide,
  extractEnvironmentVariableNames,
  getMissingEnvironmentRequirementsForStory,
} from "./environmentRequirements";
import { createStep, createStoryMetadata } from "./storyDocument";

function createStory(id: string, title: string, overrides?: Partial<Story>): Story {
  return {
    id,
    title,
    steps: [],
    metadata: createStoryMetadata(1),
    ...overrides,
  };
}

describe("extractEnvironmentVariableNames", () => {
  it("文字列から ENV 変数名を抽出する", () => {
    expect(extractEnvironmentVariableNames("https://{{LOCAL_ENV.HOST}}/api/{{LOCAL_ENV.VERSION}}"))
      .toEqual(["HOST", "VERSION"]);
  });

  it("重複を除いて返す", () => {
    expect(extractEnvironmentVariableNames("{{LOCAL_ENV.USER}}-{{LOCAL_ENV.USER}}"))
      .toEqual(["USER"]);
  });

  it("ENV 参照がなければ空配列を返す", () => {
    expect(extractEnvironmentVariableNames("https://example.com")).toEqual([]);
  });
});

describe("collectEnvironmentRequirements", () => {
  it("baseUrl, target, value から必要変数を集約する", () => {
    const stories = {
      login: createStory("login", "Login", {
        baseUrl: "https://{{LOCAL_ENV.HOST}}",
        steps: [
          createStep({ id: "step-1", order: 1, action: "navigate", target: "/{{LOCAL_ENV.PATH}}", value: "" }),
          createStep({ id: "step-2", order: 2, action: "type", target: "#user", value: "{{LOCAL_ENV.USERNAME}}" }),
        ],
      }),
    };

    const result = collectEnvironmentRequirements(stories, {
      HOST: "example.com",
      USERNAME: "admin",
    });

    expect(result).toEqual([
      {
        name: "HOST",
        displayName: "LOCAL_ENV.HOST",
        status: "available",
        occurrenceCount: 1,
        stories: [{ storyId: "login", storyTitle: "Login" }],
      },
      {
        name: "PATH",
        displayName: "LOCAL_ENV.PATH",
        status: "missing",
        occurrenceCount: 1,
        stories: [{ storyId: "login", storyTitle: "Login" }],
      },
      {
        name: "USERNAME",
        displayName: "LOCAL_ENV.USERNAME",
        status: "available",
        occurrenceCount: 1,
        stories: [{ storyId: "login", storyTitle: "Login" }],
      },
    ]);
  });

  it("同じ Story で同じ変数を複数回使っても stories は重複しない", () => {
    const stories = {
      login: createStory("login", "Login", {
        steps: [
          createStep({ id: "step-1", order: 1, action: "type", target: "#a", value: "{{LOCAL_ENV.USERNAME}}" }),
          createStep({ id: "step-2", order: 2, action: "type", target: "#b", value: "{{LOCAL_ENV.USERNAME}}" }),
        ],
      }),
    };

    const [requirement] = collectEnvironmentRequirements(stories, { USERNAME: "admin" });

    expect(requirement.occurrenceCount).toBe(2);
    expect(requirement.stories).toEqual([{ storyId: "login", storyTitle: "Login" }]);
  });

  it("複数 Story での利用を title 順に返す", () => {
    const stories = {
      b: createStory("b", "Checkout", {
        steps: [createStep({ id: "step-1", order: 1, action: "type", target: "#a", value: "{{LOCAL_ENV.API_TOKEN}}" })],
      }),
      a: createStory("a", "Login", {
        steps: [createStep({ id: "step-2", order: 1, action: "type", target: "#b", value: "{{LOCAL_ENV.API_TOKEN}}" })],
      }),
    };

    const [requirement] = collectEnvironmentRequirements(stories, {});

    expect(requirement.stories).toEqual([
      { storyId: "b", storyTitle: "Checkout" },
      { storyId: "a", storyTitle: "Login" },
    ]);
  });

  it("ENV 参照がなければ空配列を返す", () => {
    const stories = {
      login: createStory("login", "Login", {
        baseUrl: "https://example.com",
        steps: [createStep({ id: "step-1", order: 1, action: "click", target: "#submit", value: "" })],
      }),
    };

    expect(collectEnvironmentRequirements(stories, {})).toEqual([]);
  });
});

describe("getMissingEnvironmentRequirementsForStory", () => {
  it("対象 Story の missing requirements のみ返す", () => {
    const story = createStory("login", "Login", {
      baseUrl: "https://{{LOCAL_ENV.HOST}}",
      steps: [
        createStep({ id: "step-1", order: 1, action: "type", target: "#user", value: "{{LOCAL_ENV.USERNAME}}" }),
        createStep({ id: "step-2", order: 2, action: "type", target: "#pass", value: "{{LOCAL_ENV.PASSWORD}}" }),
      ],
    });

    expect(getMissingEnvironmentRequirementsForStory(story, { HOST: "example.com", USERNAME: "admin" })).toEqual([
      {
        name: "PASSWORD",
        displayName: "LOCAL_ENV.PASSWORD",
        status: "missing",
        occurrenceCount: 1,
        stories: [{ storyId: "login", storyTitle: "Login" }],
      },
    ]);
  });
});

describe("createEnvironmentSetupGuide", () => {
  it("ENV requirement があれば setup guide を返す", () => {
    const guide = createEnvironmentSetupGuide({
      storyA: createStory("storyA", "Login", {
        steps: [createStep({ id: "step-1", order: 1, action: "type", target: "#pass", value: "{{LOCAL_ENV.PASSWORD}}" })],
      }),
      storyB: createStory("storyB", "API", {
        steps: [createStep({ id: "step-2", order: 1, action: "type", target: "#token", value: "{{LOCAL_ENV.API_TOKEN}}" })],
      }),
    });

    expect(guide).toEqual({
      requirements: ["LOCAL_ENV.API_TOKEN", "LOCAL_ENV.PASSWORD"],
      footer: "Open Settings to add local values or import a .env file.",
    });
  });

  it("ENV requirement がなければ null を返す", () => {
    const guide = createEnvironmentSetupGuide({
      storyA: createStory("storyA", "Login", {
        steps: [createStep({ id: "step-1", order: 1, action: "click", target: "#submit", value: "" })],
      }),
    });

    expect(guide).toBeNull();
  });
});