# ADR-012: ブラウザバーと URL 統合

- 日付: 2026-04-03
- ステータス: 承認

## Context (背景)

### 現状の課題

Preview パネルは単一の webview を表示するだけで、ブラウザとしての基本操作が欠けている:

1. **ナビゲーション不可**: 戻る/進むボタンがない。リンクで遷移した後、前のページに戻れない
2. **URL バーが連動しない**: ページ遷移しても Toolbar の Base URL が更新されない
3. **リロードできない**: ページを手動でリロードする手段がない
4. **URL 入力の場所が不自然**: URL 入力が Toolbar にあり、Preview の操作対象と離れている

### あるべき体験

記録対象のサイトを操作する Preview は、Chrome のアドレスバーに近い操作感にしたい。URL 入力とナビゲーションは Preview 領域にまとめることで直感的になる。

### スコープ

本 ADR は単一タブでのブラウザ体験（ナビゲーション + URL 統合）をスコープとする。
複数タブ対応は ADR-013 で扱う。

## Options (選択肢)

### A. Toolbar にナビゲーションボタンを追加（最小構成）

- 戻る・進む・リロードボタンを Toolbar に追加
- URL 入力はそのまま Toolbar に残す

**メリット**: 実装が軽い
**デメリット**: URL 入力と操作対象（Preview）が離れたまま

### B. Preview 領域にブラウザバーを追加し、Toolbar の URL 入力を統合

- Preview 上部にブラウザバー（← → ↻ + URL + 履歴）を配置
- Toolbar の URL 入力を削除
- Toolbar はアプリ操作に専念

**メリット**: Chrome のメンタルモデルに合致、URL 入力が1箇所に集約
**デメリット**: Preview 領域に UI 要素が増える

## Decision (決定)

**B. ブラウザバーを Preview に追加し、Toolbar の URL 入力を統合する。**

理由:
- 「Chrome のアドレスバー」は全ユーザーが知っているメンタルモデル
- URL 入力が Toolbar とブラウザバーの2箇所にあると混乱する
- Toolbar を整理することで、記録操作（REC / Assert）がより目立つ

### 変更内容

#### 1. Preview 領域のレイアウト

```
┌─ Preview ──────────────────────────────────────────┐
│ Browser Bar                                         │
│ ← → ↻ │ https://example.com/login           │ ▼ │ │
│                                                     │
│ ┌─ webview ───────────────────────────────────────┐ │
│ │                                                 │ │
│ │              (ページ内容)                        │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

#### 2. ブラウザバーの機能

- **← 戻る**: `webview.goBack()`。`canGoBack()` が false なら disabled
- **→ 進む**: `webview.goForward()`。`canGoForward()` が false なら disabled
- **↻ リロード**: `webview.reload()`
- **URL 欄**: 現在の URL を表示。編集して Enter で遷移（`webview.loadURL()`）
- **▼ 履歴**: クリックで URL 履歴ドロップダウン表示（既存の useUrlHistory を流用）

#### 3. URL の流れ

```
① ブラウザバーに URL 入力 → Enter
② webview.loadURL(url)
③ webview の did-navigate → ブラウザバーの URL 表示を更新
④ did-finish-load → URL 履歴に自動保存
```

- ブラウザバーの URL は webview の実際の URL に追従する（Chrome と同じ）
- ページ内のリンクで遷移しても URL 表示が更新される
- 戻る/進むでも URL が追従する

#### 4. Toolbar の変更

- URL コンボボックスを削除
- Toolbar はアプリ操作に専念: `[Logo] [Preview | Canvas] [+ 画面追加] [Import] ... [REC/Stop] [Assert] [Panel] [Run All]`
- Story の `baseUrl` はブラウザバーの初期 URL として使う

#### 5. 戻る/進むの状態管理

webview の `did-navigate` イベントで `canGoBack` / `canGoForward` を更新し、ボタンの disabled 状態に反映する。

#### 6. 記録との連携

- 記録中もブラウザバーは操作可能（Chrome と同じ）
- ブラウザバーから URL を変更した場合、`navigate` ステップとして記録される（既存の did-navigate キャプチャで対応済み）

### 影響するファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/components/PreviewPanel.tsx` | ブラウザバー追加、URL 追従、ナビゲーション操作 |
| `src/components/Toolbar.tsx` | URL コンボボックス削除 |
| `src/App.tsx` | URL 関連 props の流れを変更 |
| `src/App.css` | ブラウザバーのスタイル追加 |

## Consequences (影響)

### メリット
- Chrome と同じ操作感 — ユーザーが学習コストゼロで使える
- URL 入力が1箇所に集約 — 混乱が減る
- 戻る/進むで試行錯誤しながら記録できる
- Toolbar がすっきりし、記録操作が目立つ

### デメリット
- Preview 領域にブラウザバー分の高さ（約 40px）が必要
- webview のナビゲーションイベント管理が増える

### 影響を受ける既存 ADR

| ADR | 影響 |
|-----|------|
| ADR-009 | 拡張 — Preview のレイアウト変更 |
| ADR-010 | 軽微 — 記録フローの起点がブラウザバーに変わる |
| ADR-006 | 変更 — Toolbar から URL 入力を削除 |
