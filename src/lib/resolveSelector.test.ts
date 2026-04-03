import { describe, it, expect, beforeEach } from "vitest";
import { resolveSelector } from "./resolveSelector";

function createDOM(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  return container;
}

describe("resolveSelector", () => {
  let root: HTMLElement;

  describe("CSS セレクタ", () => {
    beforeEach(() => {
      root = createDOM(`
        <input id="email" type="email" />
        <button data-testid="submit-btn">送信</button>
        <input placeholder="パスワード" />
        <div class="card">内容</div>
      `);
    });

    it("#id で要素を見つける", () => {
      const el = resolveSelector("#email", root);
      expect(el).toBeTruthy();
      expect(el?.id).toBe("email");
    });

    it("[data-testid] で要素を見つける", () => {
      const el = resolveSelector('[data-testid="submit-btn"]', root);
      expect(el).toBeTruthy();
      expect(el?.textContent).toBe("送信");
    });

    it("[placeholder] で要素を見つける", () => {
      const el = resolveSelector('[placeholder="パスワード"]', root);
      expect(el).toBeTruthy();
      expect(el?.getAttribute("placeholder")).toBe("パスワード");
    });

    it("class セレクタで要素を見つける", () => {
      const el = resolveSelector(".card", root);
      expect(el).toBeTruthy();
      expect(el?.textContent).toBe("内容");
    });

    it("存在しないセレクタは null を返す", () => {
      expect(resolveSelector("#nonexistent", root)).toBeNull();
    });

    it("不正なセレクタは null を返す", () => {
      expect(resolveSelector("[[[invalid", root)).toBeNull();
    });
  });

  describe('text="..." パターン', () => {
    beforeEach(() => {
      root = createDOM(`
        <button>ログイン</button>
        <a href="/signup">新規登録</a>
        <div><span>テスト結果</span></div>
        <div>
          <span>親テキスト</span>
          <span>子テキスト</span>
        </div>
      `);
    });

    it("ボタンのテキストで見つける", () => {
      const el = resolveSelector('text="ログイン"', root);
      expect(el).toBeTruthy();
      expect(el?.tagName).toBe("BUTTON");
    });

    it("リンクのテキストで見つける", () => {
      const el = resolveSelector('text="新規登録"', root);
      expect(el).toBeTruthy();
      expect(el?.tagName).toBe("A");
    });

    it("リーフ要素のテキストで見つける", () => {
      const el = resolveSelector('text="テスト結果"', root);
      expect(el).toBeTruthy();
      expect(el?.tagName).toBe("SPAN");
    });

    it("存在しないテキストは null を返す", () => {
      expect(resolveSelector('text="存在しない"', root)).toBeNull();
    });
  });

  describe("role=...[name=\"...\"] パターン", () => {
    beforeEach(() => {
      root = createDOM(`
        <button role="button" aria-label="送信する">Submit</button>
        <div role="tab" aria-label="設定">Settings</div>
        <button aria-label="キャンセル">Cancel</button>
      `);
    });

    it("role + aria-label で見つける", () => {
      const el = resolveSelector('role=button[name="送信する"]', root);
      expect(el).toBeTruthy();
      expect(el?.textContent).toBe("Submit");
    });

    it("div の role で見つける", () => {
      const el = resolveSelector('role=tab[name="設定"]', root);
      expect(el).toBeTruthy();
      expect(el?.textContent).toBe("Settings");
    });

    it("button タグを role として見つける（aria-label 一致）", () => {
      const el = resolveSelector('role=button[name="キャンセル"]', root);
      expect(el).toBeTruthy();
      expect(el?.textContent).toBe("Cancel");
    });

    it("存在しない name は null を返す", () => {
      expect(resolveSelector('role=button[name="存在しない"]', root)).toBeNull();
    });
  });

  describe('label:has-text("...") >> tag パターン', () => {
    beforeEach(() => {
      root = createDOM(`
        <label>名前<input type="text" class="name-input" /></label>
        <label for="email-field">メールアドレス</label>
        <input id="email-field" type="email" />
        <label>電話番号<textarea></textarea></label>
      `);
    });

    it("ラベル内の input を見つける", () => {
      const el = resolveSelector('label:has-text("名前") >> input', root);
      expect(el).toBeTruthy();
      expect(el?.classList.contains("name-input")).toBe(true);
    });

    it("label[for] で関連付けられた input を見つける", () => {
      const el = resolveSelector('label:has-text("メールアドレス") >> input', root);
      expect(el).toBeTruthy();
      expect(el?.id).toBe("email-field");
    });

    it("ラベル内の textarea を見つける", () => {
      const el = resolveSelector('label:has-text("電話番号") >> textarea', root);
      expect(el).toBeTruthy();
      expect(el?.tagName).toBe("TEXTAREA");
    });

    it("存在しないラベルは null を返す", () => {
      expect(resolveSelector('label:has-text("住所") >> input', root)).toBeNull();
    });
  });
});
