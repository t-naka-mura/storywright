import { parse } from "dotenv";
import fs from "fs";

export interface EnvironmentSettingsLike {
  envFilePath?: string;
}

export interface EnvironmentSourceStatusLike {
  mode: "process-env" | "env-file";
  envFilePath?: string;
  loadedVariableCount: number;
  error?: string;
}

export function normalizeEnvironmentSettings(settings: EnvironmentSettingsLike | null | undefined): EnvironmentSettingsLike {
  const envFilePath = settings?.envFilePath?.trim();
  return envFilePath ? { envFilePath } : {};
}

export function resolveEnvironmentWithSettings(
  baseEnv: NodeJS.ProcessEnv,
  settings: EnvironmentSettingsLike | null | undefined,
  readFileSync: (path: string, encoding: BufferEncoding) => string = fs.readFileSync,
): NodeJS.ProcessEnv {
  const normalized = normalizeEnvironmentSettings(settings);
  if (!normalized.envFilePath) {
    return { ...baseEnv };
  }

  let fileContent: string;
  try {
    fileContent = readFileSync(normalized.envFilePath, "utf-8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load .env file: ${reason}`);
  }

  return {
    ...baseEnv,
    ...parse(fileContent),
  };
}

export function inspectEnvironmentSource(
  baseEnv: NodeJS.ProcessEnv,
  settings: EnvironmentSettingsLike | null | undefined,
  readFileSync: (path: string, encoding: BufferEncoding) => string = fs.readFileSync,
): EnvironmentSourceStatusLike {
  const normalized = normalizeEnvironmentSettings(settings);
  if (!normalized.envFilePath) {
    return {
      mode: "process-env",
      loadedVariableCount: Object.keys(baseEnv).length,
    };
  }

  try {
    const resolvedEnv = resolveEnvironmentWithSettings(baseEnv, normalized, readFileSync);
    return {
      mode: "env-file",
      envFilePath: normalized.envFilePath,
      loadedVariableCount: Object.keys(resolvedEnv).length,
    };
  } catch (error) {
    return {
      mode: "env-file",
      envFilePath: normalized.envFilePath,
      loadedVariableCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}