import { parse } from "dotenv";
import fs from "fs";

export interface EnvironmentSettingsLike {
  envFilePath?: string;
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