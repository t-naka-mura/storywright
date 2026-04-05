# ADR-019: タブごとの baseURL 管理

- 日付: 2026-04-04
- ステータス: 承認済み

## Context (背景)

現在、URL バー（アドレスバー）の入力はグローバルな `baseUrl` を更新する。`baseUrl` は `useUrlHistory` フックで管理されアプリ全体で1つしか存在しない。

PreviewPanel の `useEffect` は `url` prop（= グローバル `baseUrl`）が変わるたびにアクティブタブへ `loadPreviewUrl(url)` を実行するため、**あるタブでURL を入力すると、他のタブに切り替えた際にもそのURLがロードされてしまう**。

Electron 側の各 `PreviewTab` は既に個別の `url` を保持しており、タブ切り替え時にアドレスバーは `activeTab.url` に更新される。しかし上位の `baseUrl` が変わっていないため、タブを切り替えても `url` prop との差分で再ロードが走る。

BASE や Stores のようにショップとカートで別ホストを使うケースでは、タブごとに異なる URL を開いておきたいニーズがあり、現状ではそれができない。

## Options (選択肢)

### A. アドレスバーの入力を baseUrl から切り離す

- アドレスバーの Enter / URL 履歴選択 → `loadPreviewUrl` を直接呼ぶ（アクティブタブのみ）
- `baseUrl`（グローバル）は**最後に使った URL** として履歴・永続化専用に残す
- PreviewPanel の `useEffect` で `url` prop とアクティブタブの `url` を比較してロードするロジックを削除し、明示的な操作（Enter 押下、履歴クリック、story 選択）でのみロードする

**メリット**
- 変更が PreviewPanel + App.tsx に閉じる、最小限の改修
- Electron 側のタブ管理は変更不要
- Story の `baseUrl` 解決ロジックに影響しない

**デメリット**
- `baseUrl` と「アクティブタブの URL」が乖離する可能性がある
- Story の baseUrl 自動設定（記録時に baseUrl を設定する等）は別途考慮が必要

### B. baseUrl をタブごとに管理する

- `useUrlHistory` を拡張し、タブ ID ごとの URL マップを持つ
- タブ切り替え時に `baseUrl` を切り替える
- 永続化も `{ [tabId]: url }` 形式に変更

**メリット**
- 概念的にクリーン（各タブが独立した baseUrl を持つ）

**デメリット**
- `useUrlHistory` の永続化フォーマット変更（マイグレーション必要）
- タブはセッション間で永続化されないため、タブ ID と baseUrl の紐付けが不安定
- Story の `baseUrl` との関係が複雑になる（どのタブの baseUrl を使うか）

### C. グローバル baseUrl を廃止し、常に story.baseUrl を使う

- アドレスバーは純粋にプレビュー用で、story 実行時は `story.baseUrl` のみ参照
- 記録開始時にアクティブタブの URL を `story.baseUrl` に自動設定

**メリット**
- baseUrl の二重管理がなくなる
- Story の実行が URL バーの状態に依存しなくなる

**デメリット**
- 大幅なリファクタリングが必要
- 「URL を入れてすぐ記録」のフローが変わる可能性
- 既存の E2E テストへの影響が大きい

## Decision (決定)

**案 A を推奨。** 最小の変更で問題を解決でき、Electron 側のタブ管理に手を入れずに済む。

主な変更点:
1. **PreviewPanel**: `url` prop 変更時の自動 `loadPreviewUrl` を廃止。URL ロードは明示的操作（Enter、履歴選択）のみで発火
2. **App.tsx**: `previewUrl` の算出は残すが、PreviewPanel への伝搬はアドレスバーの初期値として使い、自動ロードのトリガーにしない
3. **Story 選択時**: `selectedStory.baseUrl` がある場合はアクティブタブにロード（これは既存の明示的操作なので維持）
4. **記録開始時**: アクティブタブの現在の URL を `baseUrl` として使用（既存動作を維持）

## Consequences (影響)

### メリット
- タブごとに異なる URL を開いたままにできる
- タブ切り替え時の不要な URL リロードがなくなる
- クロスホスト運用（ショップ + カート等）がスムーズになる

### デメリット
- 「URL バーに入力 → 全タブに反映」という動作を期待するユーザーがいた場合、挙動が変わる
- アドレスバーの URL とグローバル `baseUrl` の関係を整理する必要がある

### 影響範囲
- `src/components/PreviewPanel.tsx` — URL prop の自動ロード effect を改修
- `src/App.tsx` — `previewUrl` の PreviewPanel への渡し方を調整
- `e2e/` — URL ロード関連のテストヘルパー（`loadPreviewUrl`）への影響を確認
- `useUrlHistory` — 変更不要（グローバル baseUrl は履歴永続化用に残す）
