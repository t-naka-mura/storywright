/**
 * Sensitive ステップの暗号化/復号ユーティリティ。
 * Electron の safeStorage に依存する部分を encrypt/decrypt コールバックで注入し、
 * ステップ変換ロジック自体はテスト可能な純粋関数として提供する。
 */

interface StepLike {
  sensitive?: boolean;
  value?: string;
  [key: string]: unknown;
}

interface StoryLike {
  steps?: StepLike[];
  [key: string]: unknown;
}

export function transformSensitiveSteps(
  data: unknown,
  transformValue: (value: string) => string,
): unknown {
  if (!data || typeof data !== "object") return data;
  const record = data as Record<string, StoryLike>;
  const result: Record<string, unknown> = {};
  for (const [key, story] of Object.entries(record)) {
    if (!story || !Array.isArray(story.steps)) {
      result[key] = story;
      continue;
    }
    result[key] = {
      ...story,
      steps: story.steps.map((step) =>
        step.sensitive && step.value
          ? { ...step, value: transformValue(step.value) }
          : step,
      ),
    };
  }
  return result;
}

/**
 * input[type="password"] のターゲットセレクタから sensitive を推定する。
 * レコーダー側で付与するが、手動入力時の補助判定にも使える。
 */
export function isSensitiveTarget(target: string): boolean {
  return /\[type=["']?password["']?\]/.test(target);
}
