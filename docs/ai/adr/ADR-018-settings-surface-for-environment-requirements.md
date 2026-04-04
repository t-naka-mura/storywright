# ADR-018: Environment Requirements を表示する Settings surface

- 日付: 2026-04-04
- ステータス: 提案

## 実装進捗サマリ（2026-04-04 時点）

### 実装済み

- `ENV.*` requirement を集約する pure helper
- `available` / `missing` 判定
- app menu から開く独立 `Settings` window
- Environment Variables セクションの一覧表示
- 左 navigation を含む settings window の基本レイアウト
- 実行前ダイアログから `Settings` を開く導線
- Step / Base URL 編集中に `Settings` を開く導線
- `.env` ファイルパスを保存する最小 UI

### まだ未実装

- local secret store の編集 UI
- 実行前チェック結果を Settings と同期して強調表示する UI
- 複数カテゴリを持つ本格的な settings IA
- `.env` の妥当性検証や読み込み状態の詳細表示

### 現在地

ADR-018 の Phase 1 は最小成立している。
加えて `.env` パス指定の最小 UI まで入ったが、現状はまだ diagnostics 中心であり、settings platform としては初期段階である。

## Context (背景)

ADR-016 により、Story の step では `{{ENV.NAME}}` 記法を使って実行時に環境変数を解決できるようにした。
また、ADR-017 により、Story 本体は portable data として保持し、local-only な設定や secret は別境界で扱う方針を採っている。

この状態で次に問題になるのは、ユーザーが「どの環境変数が必要で、今どれが足りないか」を UI 上で把握しにくい点である。

現状の UI は Story 編集と実行に主眼があり、実行環境の診断や設定状態の可視化を行う場所がない。

## Problem Statement

`{{ENV.*}}` をサポートしても、必要変数の発見と不足状態の把握をユーザーに委ねたままだと、次の問題が残る。

- 実行時エラーになるまで不足変数に気づけない
- Story 編集と実行環境管理の責務が混ざる
- export/import された Story を開いたとき、何を設定すべきか分かりにくい
- 将来的な local secret store や `.env` 対応の UI 置き場が定まらない

## Options (選択肢)

### Option A: Story 画面の中で都度表示する

- DetailPanel や StepEditor の中で必要変数や不足変数を表示する

**メリット:**

- 画面追加が不要
- 実装が小さく見える

**デメリット:**

- Story 編集と実行環境管理が混ざる
- 全 Story 横断の一覧性がない
- 将来の `.env` / secret store UI の置き場として窮屈

### Option B: 独立した Settings surface を設ける

- アプリ全体の設定 surface として `Settings` を追加する
- Environment Variables セクションで必要変数一覧と状態を表示する

**メリット:**

- Story 編集と環境管理の責務を分離できる
- 全 Story 横断で必要変数を一覧できる
- 将来的な `.env` / local secret store / app settings を同じ場所に集約できる

**デメリット:**

- 画面追加の実装コストがある
- 初期段階ではやや大げさに見える可能性がある

### Option C: 実行前ダイアログだけに留める

- 実行ボタン押下時に必要変数の不足だけをダイアログ表示する

**メリット:**

- 実装が比較的小さい
- 不足変数に最低限は気づける

**デメリット:**

- 事前診断ができない
- 設定状態の常時可視化ができない
- 将来の設定 UI の基盤になりにくい

## Decision (決定)

**Option B を採用する。**

Storywright に、Story 編集画面とは分離した `Settings` surface を設ける。

この Settings surface は、少なくとも初期段階では「環境変数 requirements の可視化」を責務とし、値の直接編集を必須要件にはしない。

初期実装は full-page に限定せず、独立 window を含む軽量な settings surface を許容する。

## Scope

### Phase 1

Settings surface に次を表示する。

- 現在の Story 群から抽出した `ENV.*` 変数名一覧
- 各変数の状態
  - `available`
  - `missing`
- どの Story で使われているか
- 「この設定は export されない local information である」ことの説明

実装状況:

- すべて実装済み

### Phase 2 以降の拡張候補

- `.env` ファイルの指定
- local secret store に保存された値の編集
- 実行前の設定検証導線
- URL 履歴や preview 設定など、他の local app settings の集約

実装状況:

- 実行前の設定検証導線は一部実装済み
- `.env` ファイル指定は最小形のみ実装済み
- その他は未着手

## UI 方針

### surface 位置

- `Story` / `Preview` とは別責務の `Settings` surface とする
- 初期実装では app menu から開く独立 window を許容する
- `System` より `Settings` の名称を優先する

### 初期表示内容

- セクション名: `Environment Variables`
- 各行の項目:
  - 変数名
  - 状態 (`available` / `missing`)
  - 参照中の Story 数または Story 名一覧

### 初期フェーズでやらないこと

- 値そのものの表示
- portable Story の中への値埋め込み
- export 対象データへの混入

## ADR-016 / ADR-017 との関係

- ADR-016 は `{{ENV.*}}` の実行時解決を定義する
- ADR-017 は portable Story と local-only data の境界を定義する
- ADR-018 はそれらをユーザーが扱うための UI surface を定義する

したがって、ADR-018 は ADR-016 と ADR-017 の補完関係にある。

## Consequences (影響)

### メリット

- 実行前に不足変数を把握しやすくなる
- Story 編集と環境管理の責務が分離される
- export/import 後のセットアップ導線が分かりやすくなる
- 将来の `.env` / secret store UI の拡張先が明確になる

### デメリット

- 新しい UI surface を追加する必要がある
- 初期段階では read-only の情報画面に見える可能性がある

## Non-Goals

- この ADR では `.env` 編集 UI の実装有無は決めない
- この ADR では local secret store の入力 UX 詳細は決めない
- この ADR では Settings surface 全体の最終 IA は決めない

## Follow-ups

- Story 群から `{{ENV.*}}` を抽出する pure helper を追加する
- `available` / `missing` を判定する environment diagnostics を追加する
- Settings surface の最小 UI spec を作る
- 実行前ダイアログが必要かは別途判断する