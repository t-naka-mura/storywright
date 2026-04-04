# Story Import / Export 最小仕様

## 概要

ADR-017 に基づき、portable な StoryDocument を外部ファイルとして export / import する最小 UI を定義する。

このフェーズでは、安全側の share export と、上書きしない safe import を優先する。

## ゴール

- 現在の Story 群を JSON ファイルとして export できる
- 選択中の 1 Story だけを export できる
- 外部ファイルから StoryDocument を import できる
- import 時に既存 Story を壊さない
- sensitive 値の実体を export に含めない

## 非ゴール

- backup export の暗号化パッケージ
- import 時の詳細な merge UI
- secret store の再入力フロー全体
- 複数ファイル同時 import

## フォーマット

- 拡張子は `.storywright.json` を推奨する
- 中身は `schemaVersion: 1` を持つ `StoryDocument`
- `exportedAt` を含める

## Export 方針

### Export All

- 現在の Story 群すべてを 1 ファイルに出力する
- Toolbar から実行できる

### Export Selected

- 選択中 Story のみを 1 ファイルに出力する
- Story detail 側から実行できる

### Sensitive 値

- `sensitive: true` な step の `value` 実体は export に含めない
- 既存の `valueRef` があれば保持してよい
- `valueRef` がなくても export 自体は成功させる

## Import 方針

- 1 ファイル選択で import する
- `StoryDocument` と旧 record 形式の両方を受け入れる
- 読み込めた Story は現在の state にマージする

### ID 衝突時

- 上書きしない
- 新しい story id を採番して複製として追加する
- title は既存と見分けられるように ` (imported)` 系 suffix を付ける

### エラー方針

- JSON parse 失敗や空ファイルは import エラーとして表示する
- 未解決 `valueRef` や `{{ENV.*}}` は import 失敗理由にしない

## 最小 UI

### Toolbar

- `Import`
- `Export All`

### Story Detail

- 選択中 Story があるときだけ `Export`

### フィードバック

- 完了時は件数を含む簡潔なメッセージを表示する
- エラー時は理由を表示する

## 将来拡張

- overwrite / duplicate / merge の選択 UI
- backup export
- import 後の missing secrets / missing env setup guide