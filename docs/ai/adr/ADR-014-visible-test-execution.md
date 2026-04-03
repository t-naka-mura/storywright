# ADR-014: テスト実行を Preview で可視化する

- 日付: 2026-04-03
- ステータス: 提案

## Context (背景)

### 現状の課題

テスト実行（Run）は Playwright のヘッドレスブラウザで行われるため、ユーザーは実行中の動作を見ることができない。結果だけが返ってくる。

1. **動作が見えない**: テストが何をやっているかわからず、失敗時のデバッグが難しい
2. **録画と実行の断絶**: 録画は Preview の webview で行うが、実行は別のヘッドレスブラウザ。同じサイトなのに操作環境が異なる
3. **フィードバックが遅い**: 全ステップ完了まで結果がわからない

### あるべき体験

Run を押すと Preview 上でステップが1つずつ実行されていく様子が見える。アプリ内で完結し、成功/失敗がリアルタイムにわかる。

## Options (選択肢)

### A. Playwright をヘッドフルで起動して別ウィンドウに表示

- `headless: false` で Playwright を起動

**メリット**: 実装が最もシンプル
**デメリット**: 別ウィンドウが開く、アプリ内で完結しない

### B. Playwright の connectOverCDP で webview に接続

- Electron を `--remote-debugging-port` 付きで起動し、Playwright が CDP 経由で webview に接続

**メリット**: Playwright API がそのまま使える
**デメリット**: Electron webview のターゲットを Playwright が正しく認識できるか不確実

### C. Preview の webview を CDP + executeJavaScript で直接操作

- 録画で既に確立した CDP 接続と `executeJavaScript()` を使い、テストステップを実行
- Playwright のロケーター構文を解決するセレクタエンジンを webview に注入
- ナビゲーションは CDP `Page.navigate` または `webview.loadURL()`

**メリット**: アプリ内で完結、既存のインフラ（CDP接続、スクリプト注入）を流用、外部ブラウザ不要
**デメリット**: Playwright のロケーター構文を自前で実装する必要がある（ただしレコーダーが生成するパターンは限定的）

## Decision (決定)

**C. Preview の webview を CDP + executeJavaScript で直接操作する。**

理由:
- アプリ内で完結する（別ウィンドウが開かない）
- 録画と実行が同じ webview 上で行われ、体験が一貫する
- 録画で確立した CDP インフラをそのまま流用できる
- レコーダーが生成するセレクタパターンは限定的で、全パターンの実装は現実的

### 変更内容

#### 1. セレクタ解決エンジン（webview に注入）

レコーダーが生成するセレクタパターンをすべてカバーする:

| パターン | 例 | 解決方法 |
|---------|---|---------|
| CSS セレクタ | `#email`, `button[type=submit]` | `document.querySelector()` |
| `[data-testid="..."]` | `[data-testid="login-btn"]` | `document.querySelector()` |
| `[placeholder="..."]` | `[placeholder="メールアドレス"]` | `document.querySelector()` |
| `text="..."` | `text="ログイン"` | テキスト内容でボタン/リンクを検索 |
| `role=...[name="..."]` | `role=button[name="送信"]` | `aria-label` + role 属性で検索 |
| `label:has-text("...") >> input` | `label:has-text("名前") >> input` | ラベルテキストで検索 → 子要素取得 |

#### 2. アクション実行エンジン（webview に注入）

```javascript
// 注入スクリプトが提供する関数
window.__storywrightExecuteStep = async function(step) {
  const el = resolveSelector(step.target);
  switch (step.action) {
    case 'click':    el.click(); break;
    case 'type':     el.focus(); el.value = ''; el.dispatchEvent(new Event('input')); /* ... */ break;
    case 'select':   el.value = step.value; el.dispatchEvent(new Event('change')); break;
    case 'assert':   /* textContent チェック */ break;
    case 'wait':     /* ポーリングで要素の表示/非表示を待つ */ break;
  }
}
```

#### 3. メインプロセスの実行ロジック（electron/main.ts）

```
runStoryOnWebview(story):
  wc = findWebviewContents()
  wc に実行エンジンスクリプトを注入
  セッションデータをクリア（クリーンな状態で実行）
  
  for step in story.steps:
    renderer に「ステップ開始」を通知
    if step.action === 'navigate':
      CDP Page.navigate で遷移
      ページロード完了を待つ
    else:
      wc.executeJavaScript('__storywrightExecuteStep(step)')
    renderer に「ステップ完了 + 結果」を通知
    slowMo 分だけ待機（操作の様子を見やすくする）
```

#### 4. テスト前のクリーンアップ

デフォルトでは webview のセッションデータをクリアしてからテストを開始する。
ただし「セッションを維持」オプションで無効化できる（ログイン済み状態でテストしたい場合など）。

```typescript
if (!keepSession) {
  const session = wc.session;
  await session.clearStorageData();
  await session.clearCache();
}
```

- **デフォルト: クリーンアップする**（テストの再現性を優先）
- **「セッションを維持」チェックボックス**: DetailPanel の Run ボタン付近に配置

#### 5. 実行中の UI 制御

- テスト実行中はブラウザバーの操作を無効化（ユーザーの介入を防ぐ）
- 録画中は Run を無効化（録画と実行の同時実行を防ぐ）

### 影響するファイル

| ファイル | 変更内容 |
|---------|---------|
| `electron/main.ts` | webview 上でのステップ実行ロジック、セレクタ解決 + アクション実行スクリプト、ステップ進捗通知 |
| `electron/preload.ts` | ステップ進捗の IPC ブリッジ追加 |
| `src/components/PreviewPanel.tsx` | 実行中のブラウザバー無効化 |
| `src/App.tsx` | 実行中フラグの管理、録画/実行の排他制御 |

## Consequences (影響)

### メリット
- テスト実行が Preview 内で完結し、動作が目視確認できる
- 録画と実行が同じ環境で行われ、体験が一貫する
- 外部ブラウザが開かない（アプリ内で完結）
- 失敗時に Preview 上で失敗箇所のページ状態がそのまま見える

### デメリット
- Playwright のロケーター構文を自前で実装するため、エッジケースで動作差異が出る可能性
- webview ベースの実行は Playwright ほどのタイムアウト制御やリトライが効かない
- Playwright を使った「正式な」E2E テストとは別物になる（将来、両方をサポートする可能性）

### 軽減策
- セレクタ解決のテストを書き、レコーダーが生成する全パターンをカバーする
- タイムアウト・リトライのロジックを実行エンジンに組み込む
- 将来的に Playwright ヘッドフル実行（Option A）も「エクスポート＆実行」として併存させる選択肢を残す

### 影響を受ける既存 ADR

| ADR | 影響 |
|-----|------|
| ADR-008 | 変更 — 実行エンジンが Playwright → webview CDP に変わる |
