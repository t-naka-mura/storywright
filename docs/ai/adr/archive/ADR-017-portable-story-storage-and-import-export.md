# ADR-017: Portable Story Storage と Import/Export 境界

- 日付: 2026-04-04
- ステータス: 承認済み（実装完了）

## Context (背景)

現状の Storywright は、Story 定義と URL 履歴を Electron main process 経由でローカル JSON に保存している。

- `stories.json`: Story 定義本体
- `urlHistory.json`: URL 履歴と最後に使った baseUrl

この方式はシンプルだが、今後以下の要求を満たすにはデータ境界を明確にする必要がある。

1. **Story の export/import**: Story を外部ファイルとして共有・バックアップ・復元したい
2. **機密値の分離**: `sensitive` な step value を共有データに含めたくない
3. **将来拡張への耐性**: Figma / Spreadsheet 由来の metadata、タグ、共通手順参照などを後方互換で追加したい
4. **ローカル専用状態の切り分け**: URL 履歴や UI 状態は Story 本体と寿命も責務も異なる

また、将来的に IndexedDB を使う可能性はあるが、IndexedDB は「UI 状態やローカルキャッシュの保存先」としては有用でも、Story 本体の共有性・可搬性・差分レビュー性を直接改善するものではない。

## Problem Statement

Story の正本をどこに置き、何を export/import 対象とし、機密値やローカル状態をどう分離するかが未定義である。

この未定義のまま実装を進めると、次の問題が起こる。

- export 時に機密値を誤って含める
- URL 履歴や UI 状態のようなローカル専用情報が共有データに混ざる
- フィールド追加時に import 互換性が壊れる
- IndexedDB 導入時に Story 本体までローカル DB に閉じてしまい、可搬性が落ちる

## Options (選択肢)

### Option A: すべてローカル JSON のまま維持

- `stories.json` に Story 本体を保存
- `urlHistory.json` に URL 履歴を保存
- `sensitive` な値も暗号化して同じ Story JSON に保持
- export/import は後から ad-hoc に追加

**メリット:**

- 現状実装の延長で最も簡単
- ファイルとして扱いやすい

**デメリット:**

- export/import の責務が曖昧なままになる
- 機密値を共有データから分離しにくい
- 将来の migration 方針が不明確

### Option B: Story 本体を IndexedDB に寄せる

- renderer 側で IndexedDB に Story を保存
- export/import 時だけ JSON 化する
- UI 状態も同じ IndexedDB に寄せる

**メリット:**

- 部分更新や検索はしやすい
- renderer 内で完結しやすい

**デメリット:**

- Story の正本がローカル DB に閉じ、可搬性が下がる
- export/import が常に変換処理前提になる
- `safeStorage` など main process 側のセキュア保存と相性が悪い
- Git 管理、レビュー、障害調査がしにくい

### Option C: Portable Story Package を正本にし、Local State と Secret Store を分離

- Story 本体は portable な JSON ドキュメントとして定義する
- URL 履歴や UI 状態はローカル専用の別ストレージに分離する
- 機密値は Story JSON に直接埋め込まず、ローカル secret store と参照 ID で連携する
- export/import は portable JSON を基準にする

**メリット:**

- export/import の責務が明確
- 共有データとローカル専用データが混ざらない
- 機密値の扱いを Story 本体から切り離せる
- Story 本体を JSON のまま維持でき、Git 管理やレビューに向く
- IndexedDB を導入する場合も、UI 状態だけに限定しやすい

**デメリット:**

- ストレージが 2 から 3 種類に分かれる
- 初期の設計と migration を丁寧に決める必要がある

## Decision (決定)

**Option C を採用する。**

この決定は ADR-016 と競合しない。ADR-016 は step 値の実行時解決を扱い、ADR-017 は保存境界と export/import 責務を扱う。

Storywright の永続化は、責務ごとに次の 3 層へ分離する。

### 1. Portable Story Package

Story の正本であり、export/import の対象。

- 形式: JSON
- 性質: 共有可能、Git 管理可能、レビュー可能、移行可能
- 含むもの:
  - Story 本体
  - Step 定義
  - 共有可能な metadata
  - schema version
- 含まないもの:
  - URL 履歴
  - UI 状態
  - 実行結果
  - ローカル機密値の実体

### 2. Local App State

端末ごとに閉じる状態。

- 例:
  - URL 履歴
  - 最後に使った baseUrl
  - 開いていた preview tab 状態
  - UI レイアウトや選択状態
- 保存先:
  - JSON でも IndexedDB でもよい
  - ただし export/import 対象には含めない

### 3. Local Secret Store

機密値の実体を保持するローカル専用ストレージ。

- 例:
  - パスワード
  - API キー
  - セッショントークン相当の固定値
- 保存先:
  - Electron `safeStorage` を前提に main process 側で保持
  - 将来的には OS キーチェーン連携も選択肢に含む
- Story 本体とは `valueRef` などの参照 ID で結ぶ

## Portable Story Package のデータ構造

Portable Story Package には、トップレベルの schema version を持たせる。

```ts
type StoryDocument = {
  schemaVersion: 1;
  exportedAt?: string;
  stories: Story[];
};

type Story = {
  id: string;
  title: string;
  baseUrl?: string;
  tags?: string[];
  source?: {
    type: "manual" | "figma" | "spreadsheet";
    ref?: string;
  };
  steps: Step[];
  metadata: {
    createdAt: number;
    updatedAt?: number;
  };
};

type Step = {
  id: string;
  order: number;
  action: "navigate" | "click" | "type" | "select" | "assert" | "wait" | "screenshot";
  target: string;
  value?: string;
  valueRef?: string;
  description: string;
  sensitive?: boolean;
};
```

### フィールド方針

- `schemaVersion`: import 時の migration 判定に使う
- `metadata.createdAt` / `updatedAt`: 監査とマージ判断に使う
- `step.id`: 並び順と識別子を分離する。将来の差分比較、マージ、部分更新に必要
- `value`: 共有可能な通常値
- `valueRef`: ローカル secret store に保存された機密値の参照 ID

## Sensitive 値の扱い

### 原則

- `sensitive` な step は、portable export に実値を含めないことを基本とする
- export/import 可能な Story と、ローカルでのみ復元できる secret を分離する

### 運用方針

#### Share Export

- 共有用 export
- `valueRef` は残してもよいが、実値は含めない
- import 後、未解決 secret として UI で再入力または環境変数設定を促す

#### Backup Export

- 個人バックアップ用 export
- 実値を含める場合は別途暗号化パッケージ化を検討する
- 平文エクスポートはデフォルトにしない

### 環境変数参照との整合

ADR-016 の `{{ENV.NAME}}` 記法はこの方針と整合する。

- `{{ENV.*}}` を使う step は portable export に適している
- ローカル secret store を使う step と環境変数参照 step は併用可能
- 値解決の優先順位は ADR-016 側で定義する
- データモデル上は `value` と `valueRef` の両立を許容する

## Local App State の保存先方針

Local App State は export/import の対象外である。

そのため、保存先は UX と実装都合で選んでよい。

- JSON を使う場合:
  - 実装が簡単
  - 障害調査がしやすい
- IndexedDB を使う場合:
  - UI 状態の細かい更新やキャッシュに向く
  - 将来の検索・インデックス最適化に向く

ただし、Story 本体の正本を IndexedDB に置くことは採用しない。

## Import / Export 要件

### Export

- Story 単体 export と複数 Story export の両方を許容する
- export ファイルには `schemaVersion` を含める
- 共有用 export は安全側に倒し、機密値を含めない
- export 時に欠落 secret があっても、Story 本体は export 可能とする

### Import

- `schemaVersion` に基づいて migration を行う
- 既存 Story との重複時は次の選択肢を UI で提示できるようにする
  - 新規追加
  - 上書き
  - 複製として追加
- 未解決 `valueRef` や未設定 `{{ENV.*}}` は import 自体の失敗理由にはせず、実行時または編集時に解決を促す

## Migration 方針

現行データからの移行は段階的に行う。

### Phase 1

- 現行 `stories.json` を `StoryDocument` 形式へ移行する
- `schemaVersion` を追加する
- `createdAt` を `metadata.createdAt` へ寄せる
- 既存 step に `step.id` を補完する

### Phase 2

- `sensitive` な step value を `valueRef` 化できるようにする
- 既存の暗号化済み値は migration 時に local secret store へ再配置する

### Phase 3

- Local App State を Story 永続化から分離する
- URL 履歴や preview 状態の保存 API を Story 保存 API から切り離す

## Consequences (影響)

### メリット

- export/import を前提にした壊れにくいデータ境界になる
- Story 本体の可搬性とレビュー性を維持できる
- 機密値を共有データから分離できる
- IndexedDB を導入する場合も責務を限定できる
- 将来の schema migration を管理しやすい

### デメリット

- 既存のシンプルな `stories.json` より設計が増える
- import/export UI と migration 実装の追加コストがある
- secret 解決 UX を別途設計する必要がある

## Non-Goals

- この ADR では import/export UI の最終形は決めない
- この ADR では results 永続化の保存先は決めない
- この ADR では Figma / Spreadsheet 連携の詳細 schema は決めない

## Follow-ups

- `src/types.ts` の Story / Step 型を portable schema に合わせて拡張する
- save/load IPC を Story 本体と Local App State で分離する
- secret store API を main process 側に追加する
- import/export のファイルフォーマット仕様と migration テストを作成する