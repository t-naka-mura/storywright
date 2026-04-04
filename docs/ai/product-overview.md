# Storywright プロダクト概要

## ビジョン

ブラウザ操作を録画して、そのままE2Eテストとして実行できるデスクトップアプリケーション。非エンジニアでもインストールするだけで使える。

## 解決したい課題

- E2Eテストの作成が面倒で、開発者に閉じがち
- テストコードを書かずに、ブラウザ操作の録画からテストを作りたい
- 録画したテストを編集・組み替えて、柔軟にE2Eシナリオを構築したい

## コア体験

**REC → Story リスト → テスト実行**

1. **REC（録画）**: ブラウザ上の操作（クリック、入力、遷移）を自動記録
2. **Story リスト**: 録画した Story を管理（リネーム、削除、並び替え、ステータス確認）
3. **テスト実行**: Story のステップを順次実行し、結果をリアルタイム表示

## アーキテクチャ

```
[React UI] ←IPC→ [Electron main process]
                        ↓ CDP (Chrome DevTools Protocol)
                  [Preview webview]
```

- 録画: webview にインジェクションスクリプトを注入し、click/type/navigate をキャプチャ
- 実行: CDP `Runtime.evaluate` でステップを直接実行（高速）
- 通信: `console.debug` 経由で webview → main process にイベント送信

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| デスクトップ | Electron |
| フロントエンド | React 19 + TypeScript + Vite |
| バックエンド | Node.js (Electron main process) |
| E2Eテスト | CDP + executeJavaScript (webview 上で直接実行) |
| パッケージマネージャ | pnpm |

## データモデル

### StoryDocument（永続化フォーマット）

```typescript
interface StoryDocument {
  schemaVersion: 1;
  stories: Record<string, Story>;
  exportedAt?: string;        // export 時のみ
}
```

### Story / Step

```typescript
interface Story {
  id: string;
  title: string;
  baseUrl?: string;
  steps: Step[];
  metadata: StoryMetadata;
}

interface StoryMetadata {
  createdAt: number;
  updatedAt?: number;
}

interface Step {
  id: string;                 // ユニーク ID（差分比較・マージ用）
  order: number;
  action: "navigate" | "click" | "type" | "select" | "assert" | "wait" | "screenshot";
  target: string;             // セレクタ or URL（{{ENV.*}} 対応）
  value: string;              // 値（{{ENV.*}} 対応）
  valueRef?: string;          // sensitive 値の local secret store 参照
  description: string;
  sensitive?: boolean;
}
```

### セレクタ生成（優先順位）

1. `data-testid` 属性
2. `role` + `aria-label`
3. ラベルテキスト (`label:has-text("...") >> input`)
4. `placeholder` 属性
5. テキスト内容 (`text="..."`)
6. `id` 属性
7. CSS セレクタ（フォールバック）

### 永続化（3層分離）

| データ | 方式 | ファイル | export 対象 |
|--------|------|----------|-------------|
| Story 定義 | JSON (StoryDocument) | `stories.json` | ✅ |
| Sensitive 値 | 暗号化 JSON (safeStorage) | `storySecrets.json` | ❌ |
| URL 履歴 | JSON | `urlHistory.json` | ❌ |
| 環境設定 | JSON | `environment.json` | ❌ |
| テスト結果 | React state | メモリ | ❌ |

## 環境変数の解決フロー

Story 実行時に `{{ENV.NAME}}` プレースホルダを実値に置換する。

```
[ユーザー] ── Run ──▶ [renderer]
                        │
                        │ IPC: run-story(storyJson)
                        ▼
                   [main process]
                        │
        ┌─────────┴─────────┐
        ▼                   ▼
      active domain        process.env
    local values
        │                   │
        └────── merge ──────┘
      domain values が優先
                        │
                        ▼
              resolveStoryEnvironmentVariables()
              {{ENV.HOST}} → "example.com"
              {{ENV.PASSWORD}} → "secret"
                        │
                        ▼
                  CDP Runtime.evaluate
                  (Preview webview 上で実行)
```

### 実行前チェック

```
[ユーザー] ── Run ──▶ [renderer]
                        │
                        │ IPC: environment:get-presence(names)
                        ▼
                   [main process]
                        │ active domain + process.env を確認
                        ▼
                  { HOST: true, PASSWORD: false }
                        │
                        ▼
                   [renderer]
                        │ missing があれば
                        ▼
                  エラーダイアログ
                  「Settings を開く」ボタン
```

## 実装済み機能

- [x] REC（click, type, navigate, select, assert の録画）
- [x] セレクタ自動生成（7段階の優先順位）
- [x] Assert モード（要素クリックでアサーション追加）
- [x] Story リスト（選択、削除、リネーム、ステータスバッジ、並び替え）
- [x] ステップ編集（StepEditor モーダル、ドラッグ&ドロップ並び替え、複製、挿入）
- [x] テスト実行（CDP Runtime.evaluate による高速実行）
- [x] 繰り返し実行（N回繰り返し + 成功/失敗サマリー）
- [x] ブラウザバー（戻る/進む/リロード/URL履歴）
- [x] URL 履歴のファイル永続化
- [x] 複数タブ対応（`target="_blank"` / `window.open` / popup）
- [x] Sensitive 値のマスキング・暗号化保存・secret store 分離
- [x] Portable Story Storage（StoryDocument + schemaVersion + step.id + metadata）
- [x] Story の export / import UI（share export + duplicate-safe import の最小形）
- [x] `{{ENV.*}}` 環境変数参照（実行時解決）
- [x] domain ごとの local key/value 管理
- [x] `.env` の active domain への取り込み
- [x] Settings window（環境変数 requirements の可視化）
- [x] 実行前の環境変数不足チェック + Settings 導線

## 今後の検討事項

- [ ] テスト結果の永続化
- [ ] import 時の overwrite / merge UI
- [ ] backup export
- [ ] Story 間のステップコピー&マージ（つぎはぎ E2E）
- [ ] `{{ENV.*}}` を含む step への sensitive 自動提案
- [ ] Figma / Google Spreadsheet 連携（当面スコープ外）

## 関連ドキュメント

- [design-philosophy.md](design-philosophy.md) — デザイン思想（Warm Functional）
- [spec-story-import-export.md](spec-story-import-export.md) — Story import / export の最小仕様
- [spec-settings-environment-requirements.md](spec-settings-environment-requirements.md) — Settings surface の最小仕様
- [docs/ai/index.md](index.md) — docs/ai 運用ガイド

### ADR（アクティブ）

- [ADR-019](adr/ADR-019-per-tab-base-url.md) — タブごとの baseURL 管理

### ADR（アーカイブ）

`docs/ai/adr/archive/` に移動済み。`git log` で過去の設計判断を参照可能。
