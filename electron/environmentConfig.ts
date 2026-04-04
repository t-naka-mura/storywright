export interface EnvironmentDomainValueLike {
  key: string;
  value: string;
}

export interface EnvironmentDomainLike {
  id?: string;
  name?: string;
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
    const name = domain.name?.trim() || `Domain ${index + 1}`;
    const values = normalizeEnvironmentDomainValues(domain.values);

    return {
      id,
      name,
      values,
    };
  });
}

export function getActiveEnvironmentDomain(settings: EnvironmentSettingsLike | null | undefined): EnvironmentDomainLike | null {
  const domains = normalizeEnvironmentDomains(settings);
  if (domains.length === 0) {
    return null;
  }

  const activeDomainId = settings?.activeDomainId?.trim();
  return domains.find((domain) => domain.id === activeDomainId) ?? domains[0];
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
): { resolvedEnv: NodeJS.ProcessEnv } {
  const normalized = normalizeEnvironmentSettings(settings);
  const activeDomain = getActiveEnvironmentDomain(normalized);
  const inlineEnvValues = Object.fromEntries((activeDomain?.values ?? []).map((entry) => [entry.key, entry.value]));

  return {
    resolvedEnv: { ...baseEnv, ...inlineEnvValues },
  };
}

export function resolveEnvironmentWithSettings(
  baseEnv: NodeJS.ProcessEnv,
  settings: EnvironmentSettingsLike | null | undefined,
): NodeJS.ProcessEnv {
  return resolveEnvironmentLayers(baseEnv, settings).resolvedEnv;
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