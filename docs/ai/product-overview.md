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

### Story

```typescript
interface Story {
  id: string;
  title: string;
  baseUrl?: string;
  steps: Step[];
  createdAt?: number;
}

interface Step {
  order: number;
  action: "navigate" | "click" | "type" | "select" | "assert" | "wait" | "screenshot";
  target: string;   // セレクタ or URL
  value: string;
  description: string;
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

### 永続化

| データ | 方式 | 場所 |
|--------|------|------|
| Story 定義 | JSON | `.storywright/stories.json` |
| URL 履歴 | JSON | `.storywright/urlHistory.json` |
| テスト結果 | React state（セッション中のみ） | メモリ |

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

## 今後の検討事項

- [ ] 複数タブ対応（ADR-013: `target="_blank"` 対応）
- [ ] テスト結果の永続化
- [ ] Story 間のステップコピー&マージ（つぎはぎ E2E）
- [ ] Figma / Google Spreadsheet 連携（当面スコープ外）

## 関連ドキュメント

- [design-philosophy.md](design-philosophy.md) — デザイン思想（Warm Functional）
- [docs/ai/index.md](index.md) — docs/ai 運用ガイド

### ADR（アクティブ）

- [ADR-011](adr/ADR-011-repeat-execution.md) — 繰り返し実行
- [ADR-013](adr/ADR-013-multi-tab-preview.md) — Preview の複数タブ対応
- [ADR-016](adr/ADR-016-environment-variable-support.md) — ステップ値での環境変数参照サポート
- [ADR-017](adr/ADR-017-portable-story-storage-and-import-export.md) — Portable Story Storage と Import/Export 境界

### ADR（アーカイブ）

`docs/ai/adr/archive/` に移動済み。`git log` で過去の設計判断を参照可能。
