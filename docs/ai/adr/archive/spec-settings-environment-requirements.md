# Settings surface 仕様: Environment Requirements

## 概要

archive 済みの ADR-016 に基づき、Storywright に `Settings` surface を追加する。

この画面の目的は、Story 実行時に使う環境変数セットを URL ごとに管理すること。

各設定セットは次の情報を持つ。

- 表示ラベル
- `hostname` 完全一致で使う URL 条件
- その URL で使う環境変数 key/value

## 背景

- ADR-016: `{{ENV.NAME}}` の実行時解決を導入した
- ADR-017: portable Story と local-only data / secret を分離した
- Settings surface の整理は ADR-016 に統合した

現在の課題は、どの URL に対してどの環境変数セットを使うかが曖昧で、手動切替前提の設計になっていること。

## ゴール

- URL ごとの環境変数セットを Settings で編集できる
- Settings 上のタブは編集対象の切替として使える
- 実行時は現在開いている URL の `hostname` 完全一致で環境変数セットを自動選択できる
- 一致する URL 設定がない場合と、必要変数が不足している場合を別のエラーとして扱える
- 設定値は local-only で、Story export には含まれない

## 非ゴール

- `.env` ファイルを GUI から編集すること
- `hostname` の部分一致やワイルドカードマッチを導入すること
- local secret store の値をこのフェーズで編集すること
- 実行前バリデーションダイアログの最終仕様を細部まで決めること

## 画面構成

### surface 名

- `Settings`

### セクション

Phase 1 では `Environment Variables` 1 セクションに次をまとめる。

- URL ごとの環境変数セット一覧
- 選択中セットの編集 UI

### レイアウト方針

- Story / Preview とは独立責務の surface とする
- 初期実装では app menu から開く独立 window を許容する
- Warm Functional に従い、情報量は多くても威圧的に見せない
- 「設定不足」は赤一色で煽らず、次のアクションが分かる表示にする

## データモデル

各設定セットは次の情報を持つ。

1. 表示ラベル
2. URL 条件
3. key/value 一覧

### 1. 表示ラベル

- Settings 上のタブ名として表示する
- 実行時の一致判定には使わない

### 2. URL 条件

- `hostname` を文字列で保持する
- 例: `example.com`
- 一致方式は完全一致のみ
- `https://example.com` のような URL 全体ではなく `hostname` だけを扱う

### 3. key/value 一覧

- `{{ENV.API_KEY}}` に対しては `API_KEY` を key として持つ
- 値は local-only で保持する

## 補足説明

`Environment Variables` セクションでは、次の説明を簡潔に示す。

- Story で `{{ENV.API_KEY}}` のように書いた値は、ここで `API_KEY` を設定して使う
- 設定値は Story 本体には export されない

## データ抽出仕様

### 抽出対象

- Story の `baseUrl`
- 各 step の `target`
- 各 step の `value`

### 抽出ルール

- `{{ENV.NAME}}` パターンをすべて収集する
- 重複はユニーク化する
- 1 つの Story 内で同じ変数を複数回使っていても、Story 情報は 1 件として扱う

## 実行時の選択ルール

### URL マッチ

- 実行時は、現在開いている実ページ URL の `hostname` を使う
- 初回は Story の `baseUrl` を開くため、その URL の `hostname` が対象になる
- navigate 後は遷移先 URL の `hostname` が対象になる
- Settings に登録された `hostname` と完全一致する設定セットを探す

### タブ切替との関係

- Settings 上のタブ切替は編集対象の切替にのみ使う
- 実行時にどの設定セットを使うかは、手動タブ選択ではなく URL 一致で決まる

### エラー条件

- 一致する URL 設定がなければ URL 不一致エラー
- URL 一致後に必要な `ENV` key が不足していれば変数不足エラー
- エラー文言はこの 2 種を分ける

## UI 状態

### 設定セットが 1 件以上ある場合

- タブと編集フォームを表示する

### 設定セットが 0 件の場合

- 空の初期セット作成を促してよい

### URL 条件が空の場合

- 保存は許可しないか、実行時に一致しない設定として扱う

### 重複 hostname がある場合

- 同一 `hostname` を持つ複数セットは許可しない
- Settings 上で重複エラーとして扱う

## 主要ユースケース

### 1. `example.com` 用設定を追加する

- ユーザーが `Settings` を開く
- 新しいタブを追加する
- ラベルを入力する
- `hostname` に `example.com` を入力する
- 必要な key/value を入力する

### 2. `staging.example.com` 用設定を分ける

- 別タブを追加する
- `hostname` を `staging.example.com` にする
- 同じ key 名でも異なる値を設定する

### 3. 実行時に自動選択される

- Story 実行で開いた URL の `hostname` を見る
- 一致する設定セットが選ばれる
- 一致しなければ URL 不一致エラーになる

## 将来拡張

### Phase 2 候補

- 設定状態の再読み込みボタン
- Story 詳細画面から `Settings` への導線

### 現在の追加実装からの変更点

- `activeDomainId` 前提の手動選択モデルは廃止対象
- タブは編集 UI として残す
- 各タブに `label` と `hostname` を分けて持たせる
- `.env` は選択中タブの key/value へ取り込む

### Phase 3 候補

- local secret store に保存された値の編集
- `ENV.*` と `valueRef` の使用状況を統合表示
- 実行前チェックとの統合

## 実装メモ

- pure helper で `ENV.*` 抽出を実装する
- URL 一致判定は `hostname` 完全一致の pure helper に切り出す
- `Settings` のタブ選択と、実行時の自動選択は責務を分ける

## 関連ドキュメント

- [ADR-016 archive](adr/archive/ADR-016-environment-variable-support.md)
- [ADR-017](adr/archive/ADR-017-portable-story-storage-and-import-export.md)
- [ADR-018 archive](adr/archive/ADR-018-settings-surface-for-environment-requirements.md)
- [design-philosophy.md](design-philosophy.md)