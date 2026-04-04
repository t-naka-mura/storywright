export interface EnvironmentDomainValueLike {
  key: string;
  value: string;
}

export interface EnvironmentDomainLike {
  id?: string;
  name?: string;
  matchHost?: string;
  values?: EnvironmentDomainValueLike[];
}

export interface EnvironmentSettingsLike {
  domains?: EnvironmentDomainLike[];
  activeDomainId?: string;
}

export interface EnvironmentSourceStatusLike {
  mode: "process-env" | "domain-values";
  loadedVariableCount: number;
  inlineValueCount: number;
  error?: string;
}

function createDefaultEnvironmentName(index: number) {
  return index === 0 ? "LOCAL_ENV" : `LOCAL_ENV_${index + 1}`;
}

function isLegacyGeneratedEnvironmentName(name: string) {
  return /^(domain|environment)\s+\d+$/i.test(name.trim());
}

function normalizeEnvironmentDomainValues(values: EnvironmentDomainValueLike[] | undefined): EnvironmentDomainValueLike[] {
  const seenKeys = new Set<string>();

  return (values ?? [])
    .map((entry) => ({ key: entry.key.trim(), value: entry.value }))
    .filter((entry) => {
      if (entry.key.length === 0 || seenKeys.has(entry.key)) {
        return false;
      }
      seenKeys.add(entry.key);
      return true;
    });
}

function normalizeEnvironmentDomains(settings: EnvironmentSettingsLike | null | undefined): EnvironmentDomainLike[] {
  const sourceDomains = settings?.domains ?? [];

  return sourceDomains.map((domain, index) => {
    const id = domain.id?.trim() || `domain-${index + 1}`;
    const rawName = domain.name?.trim() ?? "";
    const name = rawName.length === 0 || isLegacyGeneratedEnvironmentName(rawName)
      ? createDefaultEnvironmentName(index)
      : rawName;
    const matchHost = domain.matchHost?.trim() || "";
    const values = normalizeEnvironmentDomainValues(domain.values);

    return {
      id,
      name,
      matchHost,
      values,
    };
  });
}

function getHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function getActiveEnvironmentDomain(settings: EnvironmentSettingsLike | null | undefined): EnvironmentDomainLike | null {
  const domains = normalizeEnvironmentDomains(settings);
  if (domains.length === 0) {
    return null;
  }

  const activeDomainId = settings?.activeDomainId?.trim();
  return domains.find((domain) => domain.id === activeDomainId) ?? domains[0];
}

export function getMatchingEnvironmentDomain(
  settings: EnvironmentSettingsLike | null | undefined,
  url: string,
): EnvironmentDomainLike | null {
  const hostname = getHostname(url);
  if (!hostname) {
    return null;
  }

  return normalizeEnvironmentDomains(settings).find((domain) => domain.matchHost === hostname) ?? null;
}

export function normalizeEnvironmentSettings(settings: EnvironmentSettingsLike | null | undefined): EnvironmentSettingsLike {
  const domains = normalizeEnvironmentDomains(settings);
  const activeDomain = getActiveEnvironmentDomain({ ...settings, domains });

  return {
    ...(domains.length > 0 ? { domains } : {}),
    ...(activeDomain ? { activeDomainId: activeDomain.id } : {}),
  };
}

function resolveEnvironmentLayers(
  baseEnv: NodeJS.ProcessEnv,
  settings: EnvironmentSettingsLike | null | undefined,
  url?: string,
): { resolvedEnv: NodeJS.ProcessEnv } {
  const normalized = normalizeEnvironmentSettings(settings);
  const activeDomain = url ? getMatchingEnvironmentDomain(normalized, url) ?? getActiveEnvironmentDomain(normalized) : getActiveEnvironmentDomain(normalized);
  const inlineEnvValues = Object.fromEntries((activeDomain?.values ?? []).map((entry) => [entry.key, entry.value]));

  return {
    resolvedEnv: { ...baseEnv, ...inlineEnvValues },
  };
}

export function resolveEnvironmentWithSettings(
  baseEnv: NodeJS.ProcessEnv,
  settings: EnvironmentSettingsLike | null | undefined,
  url?: string,
): NodeJS.ProcessEnv {
  return resolveEnvironmentLayers(baseEnv, settings, url).resolvedEnv;
}

export function inspectEnvironmentSource(
  baseEnv: NodeJS.ProcessEnv,
  settings: EnvironmentSettingsLike | null | undefined,
): EnvironmentSourceStatusLike {
  const normalized = normalizeEnvironmentSettings(settings);
  const activeDomain = getActiveEnvironmentDomain(normalized);
  const inlineValueCount = activeDomain?.values?.length ?? 0;
  const { resolvedEnv } = resolveEnvironmentLayers(baseEnv, normalized);

  return {
    mode: inlineValueCount > 0 ? "domain-values" : "process-env",
    loadedVariableCount: Object.keys(resolvedEnv).length,
    inlineValueCount,
  };
}