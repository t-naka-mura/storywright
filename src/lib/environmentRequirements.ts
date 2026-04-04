import type { Story } from "../types";

const ENV_PLACEHOLDER_RE = /\{\{ENV\.([A-Za-z_][A-Za-z0-9_]*)\}\}/g;

export type EnvironmentRequirementStatus = "available" | "missing";

export interface EnvironmentRequirementUsage {
  storyId: string;
  storyTitle: string;
}

export interface EnvironmentRequirement {
  name: string;
  displayName: string;
  status: EnvironmentRequirementStatus;
  occurrenceCount: number;
  stories: EnvironmentRequirementUsage[];
}

export interface EnvironmentSetupGuide {
  requirements: string[];
  footer: string;
}

export function getMissingEnvironmentRequirementsForStory(
  story: Story,
  env: Record<string, string | undefined> = {},
): EnvironmentRequirement[] {
  return collectEnvironmentRequirements({ [story.id]: story }, env)
    .filter((requirement) => requirement.status === "missing");
}

export function extractEnvironmentVariableNames(text: string): string[] {
  const found = new Set<string>();

  for (const match of text.matchAll(ENV_PLACEHOLDER_RE)) {
    if (match[1]) {
      found.add(match[1]);
    }
  }

  return [...found];
}

export function collectEnvironmentRequirements(
  stories: Record<string, Story>,
  env: Record<string, string | undefined> = {},
): EnvironmentRequirement[] {
  const requirements = new Map<string, { occurrenceCount: number; stories: Map<string, EnvironmentRequirementUsage> }>();

  for (const story of Object.values(stories)) {
    const storyVars = new Set<string>();
    const fieldsToScan = [story.baseUrl ?? ""];

    for (const step of story.steps) {
      fieldsToScan.push(step.target, step.value);
    }

    for (const field of fieldsToScan) {
      for (const variableName of extractEnvironmentVariableNames(field)) {
        const existing = requirements.get(variableName) ?? {
          occurrenceCount: 0,
          stories: new Map<string, EnvironmentRequirementUsage>(),
        };

        existing.occurrenceCount += 1;
        requirements.set(variableName, existing);
        storyVars.add(variableName);
      }
    }

    for (const variableName of storyVars) {
      const requirement = requirements.get(variableName);
      if (!requirement) continue;
      requirement.stories.set(story.id, {
        storyId: story.id,
        storyTitle: story.title,
      });
    }
  }

  return [...requirements.entries()]
    .map(([name, requirement]) => ({
      name,
      displayName: `ENV.${name}`,
      status: (env[name] === undefined ? "missing" : "available") as EnvironmentRequirementStatus,
      occurrenceCount: requirement.occurrenceCount,
      stories: [...requirement.stories.values()].sort((left, right) =>
        left.storyTitle.localeCompare(right.storyTitle),
      ),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function createEnvironmentSetupGuide(stories: Record<string, Story>): EnvironmentSetupGuide | null {
  const requirements = collectEnvironmentRequirements(stories, {});

  if (requirements.length === 0) {
    return null;
  }

  return {
    requirements: requirements.map((requirement) => requirement.displayName),
    footer: "Open Settings to add local values or import a .env file.",
  };
}