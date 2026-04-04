import type { Step, Story, StoryDocument, StoryMetadata } from "../types";

const STORY_SCHEMA_VERSION = 1 as const;

let fallbackIdCounter = 0;

function createId(prefix: string): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  fallbackIdCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${fallbackIdCounter.toString(36)}`;
}

export function createStepId(): string {
  return createId("step");
}

export function createStoryMetadata(now = Date.now()): StoryMetadata {
  return { createdAt: now };
}

export function getStoryCreatedAt(story: Pick<Story, "metadata" | "createdAt">): number {
  return story.metadata?.createdAt ?? story.createdAt ?? 0;
}

export function createStep(overrides?: Partial<Step>): Step {
  return normalizeStep({
    order: 1,
    action: "click",
    target: "",
    value: "",
    description: "",
    ...overrides,
  });
}

export function normalizeStep(input: Partial<Step>, index = 0): Step {
  return {
    id: input.id ? input.id : createStepId(),
    order: typeof input.order === "number" ? input.order : index + 1,
    action: input.action ?? "click",
    target: input.target ?? "",
    value: input.value ?? "",
    description: input.description ?? "",
    ...(input.valueRef ? { valueRef: input.valueRef } : {}),
    ...(input.sensitive ? { sensitive: true } : {}),
  };
}

export function normalizeStory(input: Partial<Story> & Pick<Story, "id" | "title">): Story {
  const metadata = input.metadata ?? createStoryMetadata(input.createdAt ?? Date.now());
  const steps = Array.isArray(input.steps)
    ? input.steps.map((step, index) => normalizeStep(step, index))
    : [];

  return {
    id: input.id,
    title: input.title,
    ...(input.baseUrl ? { baseUrl: input.baseUrl } : {}),
    steps,
    metadata,
  };
}

export function normalizeStoriesData(raw: unknown): Record<string, Story> {
  if (!raw || typeof raw !== "object") return {};

  const candidate = raw as { schemaVersion?: number; stories?: unknown };
  const source = candidate.schemaVersion === STORY_SCHEMA_VERSION && candidate.stories && typeof candidate.stories === "object"
    ? candidate.stories
    : raw;

  if (!source || typeof source !== "object") return {};

  return Object.fromEntries(
    Object.entries(source as Record<string, Partial<Story>>)
      .filter(([, story]) => !!story && typeof story === "object")
      .map(([storyId, story]) => {
        const normalized = normalizeStory({
          ...story,
          id: story.id ?? storyId,
          title: story.title ?? storyId,
        });
        return [normalized.id, normalized];
      }),
  );
}

export function serializeStories(stories: Record<string, Story>): StoryDocument {
  return {
    schemaVersion: STORY_SCHEMA_VERSION,
    stories: normalizeStoriesData(stories),
  };
}