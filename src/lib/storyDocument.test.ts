import { describe, expect, it } from "vitest";
import {
  createExportStoryDocument,
  createStep,
  createStoryMetadata,
  getStoryCreatedAt,
  mergeImportedStories,
  normalizeStoriesData,
  serializeStories,
} from "./storyDocument";

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

  it("share export では sensitive value 実体を含めない", () => {
    const doc = createExportStoryDocument({
      storyA: {
        id: "storyA",
        title: "Story A",
        metadata: createStoryMetadata(1),
        steps: [createStep({ order: 1, action: "type", target: "#password", value: "secret", sensitive: true })],
      },
    });

    expect(doc.exportedAt).toBeTruthy();
    expect(doc.stories.storyA.steps[0].value).toBe("");
  });

  it("LOCAL_ENV placeholder の sensitive value は export で保持する", () => {
    const doc = createExportStoryDocument({
      storyA: {
        id: "storyA",
        title: "Story A",
        metadata: createStoryMetadata(1),
        steps: [createStep({ order: 1, action: "type", target: "#password", value: "{{LOCAL_ENV.PASSWORD}}", sensitive: true })],
      },
    });

    expect(doc.stories.storyA.steps[0].value).toBe("{{LOCAL_ENV.PASSWORD}}");
  });

  it("import 時に story id 衝突は imported copy として追加する", () => {
    const result = mergeImportedStories(
      {
        storyA: {
          id: "storyA",
          title: "Story A",
          metadata: createStoryMetadata(1),
          steps: [createStep({ order: 1 })],
        },
      },
      {
        schemaVersion: 1,
        stories: {
          storyA: {
            id: "storyA",
            title: "Story A",
            metadata: createStoryMetadata(2),
            steps: [createStep({ order: 1 })],
          },
        },
      },
    );

    expect(result.importedCount).toBe(1);
    expect(result.duplicatedCount).toBe(1);
    expect(Object.keys(result.stories)).toHaveLength(2);
    expect(Object.values(result.stories).some((story) => story.title === "Story A (imported)")).toBe(true);
  });
});