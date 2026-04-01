# インタラクティブレコーダー Phase 3 仕様

ADR-009 Phase 3: セレクタ生成の最適化、assert の対話的追加、select 対応

## 概要

Phase 2 で実装した録画の基本機能を拡張し、以下を追加する:

1. **セレクタ生成の改善** — より安定した Playwright 互換セレクタを生成する
2. **対話的 assert** — 録画中に要素を検査してアサーションを追加できる
3. **select 対応** — ドロップダウンの選択操作を録画可能にする

## 1. セレクタ生成の改善

### 現状の課題

Phase 2 のセレクタ生成は基本的な5段階戦略だが、以下の問題がある:

- `<label>` 経由の `<input>` が特定できない（ラベルテキストでフォーム要素を指定すべき）
- `placeholder` 属性を活用していない
- `<select>` 要素の `<option>` テキストが無視される
- ネストが深い要素で CSS フォールバックが不安定

### 改善内容

セレクタ優先順位を拡張する:

| 優先度 | 戦略 | 例 | 変更 |
|--------|------|-----|------|
| 1 | data-testid | `[data-testid="login-button"]` | 既存 |
| 2 | role + accessible name | `role=button[name="ログイン"]` | 既存 |
| 3 | label テキスト（input/select 向け） | `label:has-text("メール") >> input` | **新規** |
| 4 | placeholder 属性 | `[placeholder="メールアドレス"]` | **新規** |
| 5 | テキストコンテンツ | `text="ログイン"` | 既存 |
| 6 | id 属性 | `#login-btn` | 既存 |
| 7 | CSS セレクタ（フォールバック） | `form > button.primary` | 既存・改善 |

### CSS フォールバック改善

- `:nth-child()` を使って同一タグの兄弟を区別する
- `type` 属性を活用する（`input[type="email"]`）

## 2. 対話的 assert（アサートモード）

### コンセプト

録画中に「この要素にこのテキストが含まれることを確認したい」というアサーションを対話的に追加できる機能。

### 操作フロー

1. 録画中、Toolbar の **✓ Assert** ボタンをクリックしてアサートモードに入る
2. Preview 上でマウスを動かすと、要素がハイライトされる（青い枠線）
3. 要素をクリックすると、その要素のテキストコンテンツを取得
4. `assert` ステップが自動生成される（target=セレクタ, value=テキスト）
5. アサートモードは1回のクリックで自動解除され、通常の録画モードに戻る

### 技術方式

インジェクションスクリプトに **アサートモード** を追加する:

```
┌─ Main Process ───────────────────────────────────┐
│  ipcMain.handle('toggle-assert-mode')             │
│  → previewWindow.executeJavaScript(               │
│      '__storywrightSetAssertMode(true)')           │
└──────────────────────────────────────────────────┘
        ↕
┌─ Preview Window (injection script) ──────────────┐
│  assertMode = true の時:                          │
│  - mouseover: 要素にハイライト枠を表示             │
│  - click: イベントを preventDefault               │
│           テキスト取得 → assert ステップ送信        │
│           assertMode を false に戻す               │
└──────────────────────────────────────────────────┘
```

### ハイライト表示

アサートモード中、hover した要素に一時的な CSS overlay を表示する:

- 2px solid の青枠（`var(--color-accent)` 相当: `#5b7bd7`）
- 要素の `outline` を一時設定し、離脱時に元に戻す
- `pointer-events` は通常通り（クリックを受け取る必要がある）

## 3. select 対応

### 録画方式

`<select>` 要素の `change` イベントを監視し、選択された `<option>` の `value` を記録する。

インジェクションスクリプトに `change` イベントリスナーを追加:

```javascript
document.addEventListener('change', function(e) {
  var target = e.target;
  if (target.tagName === 'SELECT') {
    sendStep({
      action: 'select',
      target: generateSelector(target),
      value: target.value,
      timestamp: Date.now()
    });
  }
}, true);
```

## IPC 追加

| チャネル | 方向 | 引数 | 説明 |
|---------|------|------|------|
| `toggle-assert-mode` | renderer → main | `enabled: boolean` | アサートモード切替 |

## 型変更

```typescript
// RecordedStep に select と assert を追加
export interface RecordedStep {
  action: "navigate" | "click" | "type" | "select" | "assert";
  target: string;
  value: string;
  timestamp: number;
}

// StorywrightAPI にアサートモード追加
export interface StorywrightAPI {
  // ... 既存
  toggleAssertMode: (enabled: boolean) => Promise<void>;
}
```

## UI 変更

### Toolbar

録画中のみ表示される **✓ Assert** ボタンを追加:

```
[■ Stop] [✓ Assert]
```

- アサートモード中はボタンがアクティブ状態（アクセント色背景）
- 1回 assert を記録すると自動で通常モードに戻る

### StatusBar

- アサートモード中: `◎ Assert mode — 要素をクリックしてアサーションを追加` を表示

## ファイル変更一覧

| ファイル | 変更内容 |
|---------|---------|
| `electron/main.ts` | インジェクションスクリプト改善、アサートモード IPC、select キャプチャ |
| `electron/preload.ts` | `toggleAssertMode` 追加 |
| `src/types.ts` | RecordedStep 拡張、StorywrightAPI 拡張 |
| `src/App.tsx` | アサートモード状態管理 |
| `src/components/Toolbar.tsx` | Assert ボタン追加 |
| `src/components/StatusBar.tsx` | アサートモード表示 |
| `src/App.css` | Assert ボタンスタイル |
