type StepLike = {
  target: string;
  value: string;
};

type StoryLike<TStep extends StepLike = StepLike> = {
  id: string;
  title: string;
  baseUrl?: string;
  steps: TStep[];
};

const ENV_PLACEHOLDER_RE = /\{\{LOCAL_ENV\.([A-Za-z_][A-Za-z0-9_]*)\}\}/g;

export function resolveEnvPlaceholders(text: string, env: NodeJS.ProcessEnv = process.env): string {
  return text.replace(ENV_PLACEHOLDER_RE, (_match, variableName: string) => {
    const value = env[variableName];
    if (value === undefined) {
      throw new Error(`Environment variable is not defined: ${variableName}`);
    }
    return value;
  });
}

export function resolveStoryEnvironmentVariables<TStep extends StepLike, TStory extends StoryLike<TStep>>(
  story: TStory,
  env: NodeJS.ProcessEnv = process.env,
): TStory {
  return {
    ...story,
    baseUrl: story.baseUrl ? resolveEnvPlaceholders(story.baseUrl, env) : story.baseUrl,
    steps: story.steps.map((step) => ({
      ...step,
      target: resolveEnvPlaceholders(step.target, env),
      value: resolveEnvPlaceholders(step.value, env),
    })),
  };
}