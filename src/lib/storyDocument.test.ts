import { describe, expect, it } from "vitest";
import { createStep, createStoryMetadata, getStoryCreatedAt, normalizeStoriesData, serializeStories } from "./storyDocument";

describe("storyDocument", () => {
  it("旧 stories record 形式を正規化できる", () => {
    const result = normalizeStoriesData({
      storyA: {
        id: "storyA",
        title: "Story A",
        createdAt: 123,
        steps: [
          { order: 1, action: "click", target: "#login", value: "", description: "" },
        ],
      },
    });

    expect(result.storyA.metadata.createdAt).toBe(123);
    expect(result.storyA.steps[0].id).toBeTruthy();
  });

  it("StoryDocument 形式をそのまま正規化できる", () => {
    const result = normalizeStoriesData({
      schemaVersion: 1,
      stories: {
        storyA: {
          id: "storyA",
          title: "Story A",
          metadata: createStoryMetadata(456),
          steps: [createStep({ id: "step-a", order: 1 })],
        },
      },
    });

    expect(result.storyA.metadata.createdAt).toBe(456);
    expect(result.storyA.steps[0].id).toBe("step-a");
  });

  it("serializeStories で schemaVersion 付きドキュメントを返す", () => {
    const doc = serializeStories({
      storyA: {
        id: "storyA",
        title: "Story A",
        metadata: createStoryMetadata(789),
        steps: [createStep({ order: 1 })],
      },
    });

    expect(doc.schemaVersion).toBe(1);
    expect(doc.stories.storyA.steps[0].id).toBeTruthy();
  });

  it("metadata.createdAt を優先して story 作成日時を返す", () => {
    expect(getStoryCreatedAt({ metadata: createStoryMetadata(42), createdAt: 1 })).toBe(42);
  });
});