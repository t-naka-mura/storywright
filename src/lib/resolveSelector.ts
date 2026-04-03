/**
 * レコーダーが生成するセレクタを DOM 要素に解決する。
 * webview に注入する実行エンジンと同一ロジックを共有し、
 * ユニットテストで検証可能にするための純粋関数版。
 *
 * サポートするパターン:
 * 1. text="..."          — テキスト内容で検索
 * 2. role=...[name="..."] — ARIA ロール + 名前
 * 3. label:has-text("...") >> tag — ラベルから子要素
 * 4. CSS セレクタ (#id, [data-testid="..."], [placeholder="..."], etc.)
 */
export function resolveSelector(selector: string, root: ParentNode = document): Element | null {
  // text="..." — テキスト内容で検索
  const textMatch = selector.match(/^text="(.+)"$/);
  if (textMatch) {
    const text = textMatch[1];
    const candidates = root.querySelectorAll('button, a, [role="button"], [role="link"]');
    for (const el of candidates) {
      if (el.textContent?.trim() === text) return el;
    }
    // フォールバック: リーフ要素から検索
    const all = root.querySelectorAll("*");
    for (const el of all) {
      if (el.children.length === 0 && el.textContent?.trim() === text) return el;
    }
    return null;
  }

  // role=...[name="..."] — ARIA ロール + 名前で検索
  const roleMatch = selector.match(/^role=([\w]+)\[name="(.+)"\]$/);
  if (roleMatch) {
    const [, role, name] = roleMatch;
    const roleEls = root.querySelectorAll(`[role="${role}"], ${role}`);
    for (const el of roleEls) {
      const ariaLabel = el.getAttribute("aria-label") || el.textContent?.trim();
      if (ariaLabel === name) return el;
    }
    return null;
  }

  // label:has-text("...") >> tag — ラベルテキストから子要素を検索
  const labelMatch = selector.match(/^label:has-text\("(.+)"\) >> (\w+)$/);
  if (labelMatch) {
    const [, labelText, childTag] = labelMatch;
    const labels = root.querySelectorAll("label");
    for (const label of labels) {
      if (label.textContent?.includes(labelText)) {
        const child = label.querySelector(childTag);
        if (child) return child;
        const forId = label.getAttribute("for");
        if (forId) {
          const target = root.querySelector(`#${forId}`);
          if (target && target.tagName.toLowerCase() === childTag) return target;
        }
      }
    }
    return null;
  }

  // CSS セレクタ
  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
}
