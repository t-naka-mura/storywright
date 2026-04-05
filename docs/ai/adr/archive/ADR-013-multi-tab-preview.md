# ADR-013: Preview の複数タブ対応

- 日付: 2026-04-03
- ステータス: 承認済み（実装完了）

## Context (背景)

### 前提

ADR-012 でブラウザバーと URL 統合を実現し、単一タブでのブラウザ体験は整った。

また、Electron 35 系では `target="_blank"` / `window.open` の扱いは `webContents.setWindowOpenHandler` が中心であり、`<webview>` は Electron 公式ドキュメント上でも安定性面の注意が明示されている。

### 既知の不具合

- `target="_blank"` でタブが開いても、新タブに追従しない（現状は単一 webview のため追跡不可）。本 ADR で対応する。
しかし、以下のユースケースにはまだ対応できない:

1. **`target="_blank"` リンク**: 決済フローなどで別タブが開くが、追跡できない
2. **複数ページの並行操作**: 管理画面とユーザー画面を同時に開いて記録したい
3. **タブ間遷移の記録**: タブを切り替えながら操作するシナリオを記録したい

### 実装検証で分かった制約

ADR-013 の初期実装では、`setWindowOpenHandler` で popup を `deny` し、通知された URL を元に renderer 側で新しい `<webview>` タブを作る方式を試した。

しかしこの方式には構造的な欠陥がある:

1. **URL だけでは popup 文脈を再現できない**: `frameName`、`referrer`、`postBody`、`disposition`、`opener` との関係が失われる
2. **`about:blank` 初期化に弱い**: 実サイトでは `about:blank` で開いてから後続スクリプトで遷移するケースがあり、URL 文字列だけでは追跡できない
3. **フォームの `target="_blank"` に弱い**: POST データ付き遷移は単純な `loadURL(url)` に落とせない
4. **タブ state の責務が曖昧になる**: renderer 側のタブ URL と App 全体の `baseUrl` が競合しやすい

つまり、**popup を URL に還元してから再構成する設計では、ブラウザ互換の複数タブ体験は成立しない**。

### あるべき体験

Chrome のタブと同じ感覚で複数ページを操作でき、記録もタブをまたいで継続される。

## Options (選択肢)

### A. renderer 主導の `<webview>` 再構成を継続

- `setWindowOpenHandler` で popup を抑止
- renderer に URL などを通知して、新しい `<webview>` を作る
- タブ UI とタブ state は React が保持する

**メリット**:
- UI 実装の変更が比較的小さい
- 既存の PreviewPanel の延長で進めやすい

**デメリット**:
- popup の opener 文脈を保持できない
- `about:blank`、POST、referrer 付き遷移を壊しやすい
- Electron の `<webview>` 依存をさらに深める
- 記録対象の webContents と UI 上のタブの対応が不安定になる

### B. main process 主導で Preview タブを管理する

- popup / 新規タブ生成のソースオブトゥルースを main process に置く
- 各タブは main process が管理する guest `webContents` / `WebContentsView` として扱う
- renderer はタブバーとブラウザバーの UI だけを担当し、操作は IPC 経由で main process に委譲する
- popup で生成された guest をそのままタブとして採用する

**メリット**:
- popup の opener / referrer / postBody / frameName を維持しやすい
- ブラウザに近いタブ生成モデルになる
- 記録対象と可視タブの対応が明確になる
- `<webview>` の不安定な責務を縮小できる

**デメリット**:
- main process と renderer の責務分離をやり直す必要がある
- Preview のレイアウト連携と IPC 設計が増える
- 実装コストは現行案より高い

### C. popup は単一タブ内で開く

- `target="_blank"` を現在タブへの遷移に変換する
- タブ機能は持たない

**メリット**:
- 実装が最もシンプル

**デメリット**:
- ADR-013 の「複数タブ対応」を満たさない
- 元ページと popup ページを並行に扱えない
- 記録対象のユースケースを狭める

## Decision (決定)

**B. main process 主導で Preview タブを管理する。**

理由:
- 決済フローなど popup を含むシナリオでは、URL のみの再構成では互換性が足りない
- 記録対象を webContents 単位で正しく追跡するには、main process 側にタブの実体を持たせる必要がある
- `<webview>` の不安定なイベント系に依存し続けるより、Electron の `webContents` / `WebContentsView` を中心に据えた方が設計が一貫する

補足:
- 既存の renderer 主導実装は検証用の試作として扱い、最終設計には採用しない
- タブバー UI 自体は維持するが、タブの実体管理責務は renderer から main process に移す

### 変更内容

#### 1. 責務分離

- **main process**
  - Preview タブの生成・切替・破棄
  - popup / `window.open` / `target="_blank"` の捕捉
  - guest `webContents` / `WebContentsView` のライフサイクル管理
  - 記録対象 webContents の管理
- **renderer**
  - タブバー、ブラウザバー、空状態表示
  - main process から送られるタブ metadata の描画
  - ユーザー操作を IPC で main process に転送

#### 2. レイアウト

```
┌─ Preview ──────────────────────────────────────────┐
│ Tab Bar                                             │
│ ┌──────┐ ┌──────┐ ┌───┐                            │
│ │ Tab 1│ │ Tab 2│ │ + │                            │
│ └──────┘ └──────┘ └───┘                            │
│ Browser Bar (ADR-012)                               │
│ ← → ↻ │ https://example.com/login           │ ▼ │ │
│                                                     │
│ ┌─ Native Preview Surface ───────────────────────┐ │
│ │        (main process が保持する active tab)      │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

#### 3. タブバーの機能

- 各タブにタイトル（ページの `<title>`）と ✕ ボタン
- `+` ボタンで空白タブを追加
- `target="_blank"` / `window.open` / `<form target="_blank">` で自動的に新タブが開く
- タブ切り替えで active guest を main process 側で差し替える（ブラウザバーの URL も連動）
- 最後のタブを閉じたら空白タブを表示

#### 4. タブの状態管理

```typescript
type Tab = {
  id: string;
  title: string;
  url: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  webContentsId: number;
};

// renderer は metadata を受け取るだけ
type PreviewState = {
  tabs: Tab[];
  activeTabId: string | null;
};
```

- タブの実体は main process が保持する
- renderer は tab metadata の購読者となる
- ブラウザバー操作（back/forward/reload/loadURL）は active tab に対する command IPC とする

#### 5. popup 受け入れフロー

1. guest `webContents` が popup を要求する
2. main process が `setWindowOpenHandler` で要求詳細を受け取る
3. popup を新しい Preview タブとして採用する
4. renderer に新しいタブ metadata を通知する
5. active tab の切替時は guest 表示面を差し替える

このとき URL だけを renderer に渡して再構築するのではなく、**popup の実体を main process 側で維持したまま採用する**。

#### 6. 記録との連携

- 記録中（REC）は全タブの webContents にレコーダーをアタッチする
- 新タブが開いた際、自動的にレコーダースクリプトを注入
- タブ切り替え時の操作もステップとして記録可能
- active / inactive に関わらず Preview 管理下の guest webContents を追跡する

### 影響するファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/components/PreviewPanel.tsx` | タブバー UI とブラウザバー UI、tab metadata の描画 |
| `src/App.tsx` | Preview state の購読と選択 Story との連携整理 |
| `src/App.css` | タブバーのスタイル |
| `electron/main.ts` | タブ registry、popup 採用、guest lifecycle、記録連携 |
| `electron/preload.ts` | Preview tab state / command 用 IPC 追加 |
| `src/types.ts` | Preview tab state / command の型追加 |

## Consequences (影響)

### メリット
- 別タブが開く決済フローなどの記録が可能になる
- 複数ページを並行操作できる
- Chrome に近いタブ生成モデルになる
- popup と記録対象の対応が明確になる

### デメリット
- main process 側の実装が大きくなる
- Preview のネイティブ表示面と React UI の同期が必要になる
- 既存の `<webview>` ベース実装を一部作り直す必要がある

### 実装上の注意

- Phase 1 として、まず **タブ state のソースオブトゥルースを main process に移す**
- `baseUrl` は「最後に入力した URL 履歴」と「現在開いているタブ URL」を分離する
- renderer から main process への command は `createTab`, `closeTab`, `activateTab`, `loadUrl`, `goBack`, `goForward`, `reload` に整理する
- popup 受け入れ時は URL 文字列だけでなく、必要な navigation details を維持できる API を採用する

### 影響を受ける既存 ADR

| ADR | 影響 |
|-----|------|
| ADR-012 | 拡張 — ブラウザバーの上にタブバーを追加 |
| ADR-009 | 拡張 — 記録の複数タブ対応 |
