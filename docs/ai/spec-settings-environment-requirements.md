# Settings surface 仕様: Environment Requirements

## 概要

ADR-018 に基づき、Storywright に `Settings` surface を追加する。

この画面の初期目的は、Story 群で参照されている `{{ENV.*}}` 変数を一覧化し、現在の環境で `available` / `missing` を判定して表示すること。

値の直接編集は初期スコープに含めない。

## 背景

- ADR-016: `{{ENV.NAME}}` の実行時解決を導入した
- ADR-017: portable Story と local-only data / secret を分離した
- ADR-018: 環境 requirements を扱う独立した `Settings` surface を設ける方針を決めた

現在の課題は、必要変数の発見が実行時エラー頼みであり、事前確認 UI がないこと。

## ゴール

- 現在の Story 群で使われている `ENV.*` 変数を一覧で把握できる
- 各変数が現在の環境で利用可能かどうか分かる
- どの Story がその変数を使っているか分かる
- 「この情報は local-only で export されない」ことが UI 上で理解できる

## 非ゴール

- `.env` ファイルを GUI から編集すること
- 環境変数の実値を画面に表示すること
- local secret store の値をこのフェーズで編集すること
- 実行前バリデーションダイアログの最終仕様を決めること

## 画面構成

### surface 名

- `Settings`

### セクション

Phase 1 では次の 1 セクションのみを持つ。

- `Environment Variables`

### レイアウト方針

- Story / Preview とは独立責務の surface とする
- 初期実装では app menu から開く独立 window を許容する
- Warm Functional に従い、情報量は多くても威圧的に見せない
- 「設定不足」は赤一色で煽らず、次のアクションが分かる表示にする

## 表示項目

各環境変数について、次の情報を表示する。

1. 変数名
2. 状態
3. 使用中 Story 情報

### 1. 変数名

- 例: `ENV.USERNAME`
- 実データ上は `USERNAME` をキーとして扱うが、UI 表示は Story 記法に寄せて `ENV.USERNAME` と見せる

### 2. 状態

状態は次の 2 値とする。

- `available`
  - 現在の環境で値が取得可能
- `missing`
  - 現在の環境で値が取得できない

表示例:

- `available` は穏やかな成功色のバッジ
- `missing` は攻撃的でない警告色のバッジ

### 3. 使用中 Story 情報

- 使用 Story 数を表示する
- 可能なら Story 名一覧も表示する
- 初期は一覧が長くなりすぎないよう、省略表示を許容する

表示例:

- `3 stories`
- `Login`, `Checkout`, `Invite user`

## 補足説明

`Environment Variables` セクションの上部または下部に、次の説明を表示する。

- これらの設定値は Story 本体には export されない
- Story を共有した場合、受け手の環境で同名変数を設定する必要がある

## データ抽出仕様

### 抽出対象

- Story の `baseUrl`
- 各 step の `target`
- 各 step の `value`

### 抽出ルール

- `{{ENV.NAME}}` パターンをすべて収集する
- 重複はユニーク化する
- 1 つの Story 内で同じ変数を複数回使っていても、Story 情報は 1 件として扱う

### 判定ルール

- `process.env.NAME` が `undefined` でなければ `available`
- `undefined` の場合は `missing`

補足:

- 空文字の扱いは実装側で検討余地があるが、Phase 1 では `undefined` 判定のみを必須要件とする

## UI 状態

### 変数が 1 件以上ある場合

- 一覧テーブルまたはリストを表示する

### 変数が 0 件の場合

- 空状態を表示する
- 例: `このワークスペースでは ENV 参照を使っていません`

### すべて available の場合

- 安心感のある補足メッセージを表示してよい
- 例: `必要な環境変数はすべて見つかりました`

### missing が 1 件以上ある場合

- 不足件数を明示する
- ただし全面的なエラー画面にはしない

## 主要ユースケース

### 1. 共有された Story を開いた直後

- ユーザーが `Settings` window を開く
- 必要な `ENV.*` 一覧を見る
- `missing` を確認し、外部で環境変数を設定する

### 2. 実行前の自己確認

- ユーザーがテスト実行前に `Settings` を開く
- `missing` がないことを確認する

### 3. Story の変更後の確認

- 新しく `{{ENV.API_TOKEN}}` を含む step を追加する
- `Settings` に新しい要件が現れる

## 将来拡張

### Phase 2 候補

- 設定状態の再読み込みボタン
- Story 詳細画面から `Settings` への導線

### 現在の追加実装

- ordered な `.env` ファイルパス群を 1 行 1 path で保存できる
- 後ろの file ほど優先される
- Settings 上で source status と利用可能変数数を確認できる

### Phase 3 候補

- local secret store に保存された値の編集
- `ENV.*` と `valueRef` の使用状況を統合表示
- 実行前チェックとの統合

## 実装メモ

- pure helper で `ENV.*` 抽出を実装する
- UI は helper の結果だけを受け取る構成にする
- `Settings` surface は read-only で始める

## 関連ドキュメント

- [ADR-016](adr/ADR-016-environment-variable-support.md)
- [ADR-017](adr/ADR-017-portable-story-storage-and-import-export.md)
- [ADR-018](adr/ADR-018-settings-surface-for-environment-requirements.md)
- [design-philosophy.md](design-philosophy.md)