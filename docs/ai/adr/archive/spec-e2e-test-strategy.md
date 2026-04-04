# E2E Test Strategy

## 概要

Storywright は React renderer だけでなく、Electron main process、WebContentsView、ローカル永続化、Settings 別ウィンドウの連携で成立している。単体テストだけでは「見た目は正しいが native preview に隠れる」「renderer と main process の境界でだけ壊れる」といった不具合を防ぎきれない。

このため、Vitest に加えて **Playwright による Electron アプリ E2E** を導入する。

## 目的

- renderer / main / native preview の結合不具合を早期に検出する
- ローカル永続化を含む実ユーザー操作の回帰を防ぐ
- 「何度も同じ指摘を繰り返す」種類の UI 不具合を自動で再現できるようにする

## テストレイヤー

### 1. 単体 / 結合テスト

- 既存方針どおり Vitest + Testing Library を継続
- 純粋関数、変換ロジック、React コンポーネントの renderer-only 挙動を担当

### 2. アプリ E2E

- Playwright で Electron アプリを起動
- userData をテストごとに隔離
- local fixture site を使って Story 実行を検証
- renderer の DOM だけでなく、main process が管理する preview bounds も test API で検証

## 初期カバレッジ

### Preview / URL history

- URL 履歴候補が表示される
- dropdown 表示時に native preview bounds が実際に退避する
- 入力中に URL が巻き戻らない

### Story playback

- REC で新規 Story を録画し、その場で step が積み上がる
- 録画完了後の Story をそのまま Run できる
- 実録画した Story が再起動後に復元され、そのまま Run できる
- 保存済み Story を選択して Run できる
- navigate / click / assert の最小フローが pass する
- step status が renderer に反映される
- renderer の `saveStories` 経由で保存された Story が再起動後に復元される
- 複数保存済み Story が一覧に復元される
- 復元された複数 Story のうち、選択した Story だけを実行できる

### Settings

- Settings window を別ウィンドウとして開ける
- LOCAL_ENV を追加・編集できる
- Hostname / Key / Value が autosave され、再起動後も復元される
- 複数 LOCAL_ENV key を要求する Story で、不足時の案内と設定後の成功実行を確認する

## テストデータ方針

- `STORYWRIGHT_USER_DATA_DIR` で userData をテスト専用ディレクトリへ切り替える
- seed データは `stories.json` / `urlHistory.json` / `environment.json` を直接書く
- 外部サービス依存を避けるため、fixture site はテストプロセス内で HTTP server を立てる
- native preview の録画テストは test-only IPC で active preview に script を流し込み、実アプリの recorder pipeline を通して検証する

## 実行方針

- ローカル: `pnpm build && pnpm test:e2e`
- CI を入れる場合も、まずは serial 実行で安定性を優先する
- flaky になりやすい箇所は screenshot / trace を残して原因追跡できるようにする

## 今後の拡張候補

- import / export の round-trip 検証
- 環境変数不足エラーから Settings 導線へのフロー
- 複数タブ / popup の実アプリ検証