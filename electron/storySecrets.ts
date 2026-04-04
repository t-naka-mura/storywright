type SecretMap = Record<string, string>;

function createValueRef(storyId: string, step: { id?: string; order?: number; valueRef?: string }): string {
  if (typeof step.valueRef === "string" && step.valueRef.length > 0) {
    return step.valueRef;
  }
  if (typeof step.id === "string" && step.id.length > 0) {
    return `secret:${storyId}:${step.id}`;
  }
  return `secret:${storyId}:order-${step.order ?? 0}`;
}

export function prepareStoriesForPersistence(data: unknown): { stories: unknown; secrets: SecretMap } {
  if (!data || typeof data !== "object" || !("stories" in data) || !data.stories || typeof data.stories !== "object") {
    return { stories: data, secrets: {} };
  }

  const secrets: SecretMap = {};
  const document = data as { stories: Record<string, { id?: string; steps?: Array<Record<string, unknown>> }> };
  const stories = Object.fromEntries(
    Object.entries(document.stories).map(([storyId, story]) => {
      if (!story || !Array.isArray(story.steps)) {
        return [storyId, story];
      }

      const effectiveStoryId = typeof story.id === "string" && story.id.length > 0 ? story.id : storyId;

      return [
        storyId,
        {
          ...story,
          steps: story.steps.map((rawStep) => {
            const step = rawStep as {
              id?: string;
              order?: number;
              sensitive?: boolean;
              value?: string;
              valueRef?: string;
            };

            if (!step.sensitive) {
              const { valueRef, ...rest } = step;
              return rest;
            }

            const valueRef = createValueRef(effectiveStoryId, step);
            if (typeof step.value === "string" && step.value.length > 0) {
              secrets[valueRef] = step.value;
            }

            const { value, ...rest } = step;
            return {
              ...rest,
              valueRef,
            };
          }),
        },
      ];
    }),
  );

  return {
    stories: {
      ...data,
      stories,
    },
    secrets,
  };
}

export function hydrateStoriesWithSecrets(data: unknown, secrets: SecretMap): unknown {
  if (!data || typeof data !== "object" || !("stories" in data) || !data.stories || typeof data.stories !== "object") {
    return data;
  }

  const document = data as { stories: Record<string, { steps?: Array<Record<string, unknown>> }> };

  return {
    ...data,
    stories: Object.fromEntries(
      Object.entries(document.stories).map(([storyId, story]) => {
        if (!story || !Array.isArray(story.steps)) {
          return [storyId, story];
        }

        return [
          storyId,
          {
            ...story,
            steps: story.steps.map((rawStep) => {
              const step = rawStep as {
                sensitive?: boolean;
                value?: string;
                valueRef?: string;
              };

              if (!step.sensitive || !step.valueRef) {
                return {
                  ...step,
                  value: typeof step.value === "string" ? step.value : "",
                };
              }

              return {
                ...step,
                value: secrets[step.valueRef] ?? "",
              };
            }),
          },
        ];
      }),
    ),
  };
}