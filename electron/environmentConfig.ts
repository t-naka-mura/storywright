import { parse } from "dotenv";
import fs from "fs";

export interface EnvironmentSettingsLike {
  envFilePaths?: string[];
  envFilePath?: string;
}

export interface EnvironmentSourceStatusLike {
  mode: "process-env" | "env-files";
  envFilePaths?: string[];
  loadedVariableCount: number;
  loadedFileCount: number;
  error?: string;
}

export function normalizeEnvironmentSettings(settings: EnvironmentSettingsLike | null | undefined): EnvironmentSettingsLike {
  const envFilePaths = [
    ...(settings?.envFilePaths ?? []),
    ...(settings?.envFilePath ? [settings.envFilePath] : []),
  ]
    .map((envFilePath) => envFilePath.trim())
    .filter((envFilePath, index, array) => envFilePath.length > 0 && array.indexOf(envFilePath) === index);

  return envFilePaths.length > 0 ? { envFilePaths } : {};
}

function resolveEnvironmentLayers(
  baseEnv: NodeJS.ProcessEnv,
  settings: EnvironmentSettingsLike | null | undefined,
  readFileSync: (path: string, encoding: BufferEncoding) => string,
): { resolvedEnv: NodeJS.ProcessEnv; envFilePaths: string[] } {
  const normalized = normalizeEnvironmentSettings(settings);
  if (!normalized.envFilePaths || normalized.envFilePaths.length === 0) {
    return {
      resolvedEnv: { ...baseEnv },
      envFilePaths: [],
    };
  }

  let resolvedEnv: NodeJS.ProcessEnv = { ...baseEnv };
  for (const envFilePath of normalized.envFilePaths) {
    let fileContent: string;
    try {
      fileContent = readFileSync(envFilePath, "utf-8");
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load .env file ${envFilePath}: ${reason}`);
    }

    resolvedEnv = {
      ...resolvedEnv,
      ...parse(fileContent),
    };
  }

  return {
    resolvedEnv,
    envFilePaths: normalized.envFilePaths,
  };
}

export function resolveEnvironmentWithSettings(
  baseEnv: NodeJS.ProcessEnv,
  settings: EnvironmentSettingsLike | null | undefined,
  readFileSync: (path: string, encoding: BufferEncoding) => string = fs.readFileSync,
): NodeJS.ProcessEnv {
  return resolveEnvironmentLayers(baseEnv, settings, readFileSync).resolvedEnv;
}

export function inspectEnvironmentSource(
  baseEnv: NodeJS.ProcessEnv,
  settings: EnvironmentSettingsLike | null | undefined,
  readFileSync: (path: string, encoding: BufferEncoding) => string = fs.readFileSync,
): EnvironmentSourceStatusLike {
  const normalized = normalizeEnvironmentSettings(settings);
  if (!normalized.envFilePaths || normalized.envFilePaths.length === 0) {
    return {
      mode: "process-env",
      loadedVariableCount: Object.keys(baseEnv).length,
      loadedFileCount: 0,
    };
  }

  try {
    const { resolvedEnv, envFilePaths } = resolveEnvironmentLayers(baseEnv, normalized, readFileSync);
    return {
      mode: "env-files",
      envFilePaths,
      loadedVariableCount: Object.keys(resolvedEnv).length,
      loadedFileCount: envFilePaths.length,
    };
  } catch (error) {
    return {
      mode: "env-files",
      envFilePaths: normalized.envFilePaths,
      loadedVariableCount: 0,
      loadedFileCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}