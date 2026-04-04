import { describe, expect, it } from "vitest";
import { hydrateStoriesWithSecrets, prepareStoriesForPersistence } from "./storySecrets";

describe("storySecrets", () => {
  it("保存時に sensitive value を分離して valueRef に置き換える", () => {
    const result = prepareStoriesForPersistence({
      schemaVersion: 1,
      stories: {
        storyA: {
          id: "storyA",
          title: "Story A",
          metadata: { createdAt: 1 },
          steps: [
            {
              id: "step-1",
              order: 1,
              action: "type",
              target: "#password",
              value: "secret123",
              description: "",
              sensitive: true,
            },
          ],
        },
      },
    });

    expect(result.secrets).toEqual({
      "secret:storyA:step-1": "secret123",
    });
    expect((result.stories as { stories: Record<string, { steps: Array<Record<string, unknown>> }> }).stories.storyA.steps[0]).toEqual(
      expect.objectContaining({
        id: "step-1",
        valueRef: "secret:storyA:step-1",
        sensitive: true,
      }),
    );
    expect((result.stories as { stories: Record<string, { steps: Array<Record<string, unknown>> }> }).stories.storyA.steps[0]).not.toHaveProperty("value");
  });

  it("非 sensitive step では valueRef を落として value を保持する", () => {
    const result = prepareStoriesForPersistence({
      schemaVersion: 1,
      stories: {
        storyA: {
          id: "storyA",
          title: "Story A",
          metadata: { createdAt: 1 },
          steps: [
            {
              id: "step-1",
              order: 1,
              action: "type",
              target: "#username",
              value: "admin",
              valueRef: "secret:storyA:step-1",
              description: "",
            },
          ],
        },
      },
    });

    expect(result.secrets).toEqual({});
    expect((result.stories as { stories: Record<string, { steps: Array<Record<string, unknown>> }> }).stories.storyA.steps[0]).toEqual(
      expect.objectContaining({
        value: "admin",
      }),
    );
    expect((result.stories as { stories: Record<string, { steps: Array<Record<string, unknown>> }> }).stories.storyA.steps[0]).not.toHaveProperty("valueRef");
  });

  it("読み込み時に valueRef から sensitive value を復元する", () => {
    const result = hydrateStoriesWithSecrets(
      {
        schemaVersion: 1,
        stories: {
          storyA: {
            id: "storyA",
            title: "Story A",
            metadata: { createdAt: 1 },
            steps: [
              {
                id: "step-1",
                order: 1,
                action: "type",
                target: "#password",
                valueRef: "secret:storyA:step-1",
                description: "",
                sensitive: true,
              },
            ],
          },
        },
      },
      {
        "secret:storyA:step-1": "secret123",
      },
    ) as { stories: Record<string, { steps: Array<Record<string, unknown>> }> };

    expect(result.stories.storyA.steps[0]).toEqual(
      expect.objectContaining({
        value: "secret123",
        valueRef: "secret:storyA:step-1",
      }),
    );
  });
});