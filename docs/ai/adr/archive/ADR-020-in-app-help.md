# ADR-020: アプリ内ヘルプの導入

- 日付: 2026-04-04
- ステータス: 承認

## Context (背景)

Storywright は「非エンジニアでもインストールするだけで使える E2E テストツール」を目指している。しかし現状、アプリ内に操作ガイドやヘルプが存在せず、初めて触るユーザーが以下の点で迷う可能性がある:

- REC ボタンを押した後に何をすればいいのか
- Assert モードの使い方
- `{{ENV.API_KEY}}` のような環境変数プレースホルダの書き方
- Story の export / import の手順
- 繰り返し実行や keepSession の意味

エンジニアであればUIから推測できるが、非エンジニアのQA担当やディレクターが使う場合、最初の一歩でつまずく可能性がある。

コア機能（記録・再生・マルチタブ・環境変数・popup 対応）が一通り完成し安定したため、ヘルプコンテンツの陳腐化リスクが下がった。

## Decision (決定)

**案 A を採用。Settings と同じパターンで独立ヘルプ���ィンドウを作る。**

非エンジニアが「30分で使える」（デザイン原則 #5）を実現するために、体系的な操作ガイドをアプリ内に組み込む。

### ウィンドウ構成

Settings ウィンドウと同じパターンを踏襲:
- Electron: `openHelpWindow()` で子 BrowserWindow を作成、`#/help` ハッシュルートで読み込み
- React: `window.location.hash === "#/help"` で HelpPanel をレンダリング
- IPC: `app:open-help` ハンドラ
- Preload: `openHelpWindow()` を expose

### 開き方

- **Toolbar に `?` ボタンを追加**（パネルトグルボタンの隣）

### コンテンツ構成

左サイドナビ + 右コンテンツの 2 カラムレイアウト（Settings と同じシェル）。

| セクション | 内容 |
|---|---|
| **はじめに** | Storywright とは（1文）。基本の流れ: URL入力 → 記録 → 再生 |
| **記録する** | REC ボタンの押し方、クリック/入力が自動記録されること、Stop で完了 |
| **アサーションを追加する** | Assert モードの切り替え、要素クリックでチェック追加、テキスト一致の仕組み |
| **テストを実行する** | Run ボタン、成功/失敗の見方、繰り返し実行、セッション維持オプション |
| **ストーリーを管理する** | タイトル変更、ステップの編集・並び替え・複製・削除、Export/Import |
| **環境変数を使う** | `{{LOCAL_ENV.KEY}}` の書き方、Settings での登録方法、ホスト名マッチの説明 |

### トーン

- 専門用語を避け、操作手順ベースで説明
- 「〜してください」「〜します」の丁寧語
- 各セクションは独立して読める（順番に読む必要がない）
- スクリーンショットは入れない（メンテナンスコスト回避。テキスト + アイコン参照で伝える）

### 実装方針

#### Phase 1: ウィンドウ基盤

1. `electron/main.ts`: `openHelpWindow()` 関数を追加（`openSettingsWindow()` と同じパターン）
2. `electron/main.ts`: `ipcMain.handle("app:open-help")` を追加
3. `electron/preload.ts`: `openHelpWindow` を expose
4. `src/types.ts`: `StoryWrightAPI` に `openHelpWindow` を追加
5. `src/App.tsx`: `#/help` ルート判定と HelpPanel レンダリング

#### Phase 2: HelpPanel コンポーネント

1. `src/components/HelpPanel.tsx`: ヘルプコンテンツのメインコンポーネント
   - Settings と同じ 2 カラムレイアウト（左サイドナビ + 右コン��ンツ）
   - セクション切り替えは state 管理（React のみ、ルーティング不要）
2. `src/App.css`: HelpPanel 用のスタイル追加

#### Phase 3: Toolbar 統合

1. `src/components/Toolbar.tsx`: `?` ヘルプボタンを追加
2. `src/App.tsx`: `handleOpenHelpWindow` コールバックを追加し Toolbar に渡す

## Consequences (影響)

### メリット
- 非エンジニアが自力で基本操作を習得できる
- オフラインでも参照可能
- Warm Functional のデザイン思想と統一した体験
- Settings ウィンドウの基盤を流用するため実装コストが低い

### デメリット
- 機能追加時にヘルプコンテンツの更新が必要（ただしコア機能は安定済み）
- アプリバンドルサイズが微増（テキストコンテンツのみなので影響は軽微）

### 影響範囲
- `electron/main.ts` — ヘルプウィンドウの作成・IPC ハンドラ
- `electron/preload.ts` — API の expose
- `src/types.ts` — StoryWrightAPI 型拡張
- `src/App.tsx` — ルート判定・HelpPanel レンダリング
- `src/components/HelpPanel.tsx` — 新規コンポーネント
- `src/components/Toolbar.tsx` — ヘルプボタン追加
- `src/App.css` — HelpPanel スタイル
