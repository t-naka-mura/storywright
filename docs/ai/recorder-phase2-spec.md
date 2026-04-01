# インタラクティブレコーダー Phase 2 仕様

ADR-009 Phase 2: 録画モード基本機能（click / type / navigate の記録）

## 概要

Preview ウィンドウ上でのユーザー操作をリアルタイムにキャプチャし、ステップとして記録する。
録画した操作は既存の Story データモデルに変換され、そのまま再生（テスト実行）可能。

## アーキテクチャ

```
┌─ Renderer (React) ──────────────────────────────┐
│  Toolbar: [● REC] [■ Stop]                      │
│  PreviewPanel: 「録画中...」表示                   │
│  DetailPanel: リアルタイムでステップが追加される      │
│                                                   │
│  ipcRenderer.invoke('start-recording', url)       │
│  ipcRenderer.invoke('stop-recording')             │
│  ipcRenderer.on('recorder:step', callback)        │
└──────────────────────────────────────────────────┘
        ↕ IPC
┌─ Main Process ───────────────────────────────────┐
│  previewWindow.webContents.debugger.attach()      │
│  CDP: DOM.enable, Page.enable, Runtime.enable     │
│                                                   │
│  イベントリスナー:                                  │
│  - click → セレクタ生成 → step として送信           │
│  - input/change → type ステップとして送信           │
│  - navigation → navigate ステップとして送信         │
│                                                   │
│  mainWindow.webContents.send('recorder:step', step)│
└──────────────────────────────────────────────────┘
```

## 技術方式: Electron webContents.debugger

Playwright を録画用に使わず、Preview の BrowserWindow に直接 CDP を接続する。

**理由:**
- Preview ウィンドウは既に BrowserWindow として存在する
- `webContents.debugger` で CDP セッションに直接アクセス可能
- Playwright の追加起動が不要でシンプル

### CDP で取得するイベント

| CDP イベント | 用途 |
|-------------|------|
| `Runtime.consoleAPICalled` | デバッグ用 |
| `Page.frameNavigated` | navigate ステップ生成 |
| `DOM.setChildNodes` | DOM ツリー取得 |

### ユーザー操作のキャプチャ方式

CDP だけでは click/type イベントの直接取得が困難なため、Preview ウィンドウに **インジェクションスクリプト** を挿入してイベントをキャプチャする。

```
previewWindow.webContents.executeJavaScript(`
  // click, input, submit イベントをリッスン
  // セレクタを生成して IPC 経由で main process に通知
`)
```

`Page.addScriptToEvaluateOnNewDocument` (CDP) でページ遷移後も自動で再注入する。

## セレクタ生成戦略

ADR-009 で定義した優先順位:

| 優先度 | 戦略 | 例 |
|--------|------|-----|
| 1 | data-testid 属性 | `[data-testid="login-button"]` |
| 2 | role + accessible name | `role=button[name="ログイン"]` |
| 3 | テキストコンテンツ | `text="ログイン"` |
| 4 | id 属性 | `#login-btn` |
| 5 | CSS セレクタ（フォールバック） | `form > button.primary` |

インジェクションスクリプト内で生成する。Playwright ロケーター互換の形式で出力。

## IPC プロトコル

### 新規 IPC チャネル

| チャネル | 方向 | 引数 | 説明 |
|---------|------|------|------|
| `start-recording` | renderer → main | `url: string` | 録画開始。Preview を開き CDP 接続 |
| `stop-recording` | renderer → main | なし | 録画停止。CDP 切断 |
| `recorder:step` | main → renderer | `RecordedStep` | キャプチャしたステップを通知 |

### RecordedStep 型

```typescript
interface RecordedStep {
  action: "navigate" | "click" | "type";
  target: string;   // セレクタ or URL
  value: string;     // type の入力値、他は空文字
  timestamp: number; // キャプチャ時刻
}
```

## UI 変更

### Toolbar

- Preview タブ選択時に **● REC** ボタンを表示
- 録画中は **■ Stop** ボタンに切り替わる
- 録画中は REC ボタンが赤く点滅（`recording` クラス）

### PreviewPanel

- 録画中は「録画中... ブラウザで操作してください」を表示
- 録画停止後は「録画完了 — n ステップ記録しました」を表示

### DetailPanel

- 録画中のステップがリアルタイムで追加表示される
- 録画で追加されたステップは既存の手動ステップと同じデータ構造
- 録画停止後、通常通り編集・削除が可能

### StatusBar

- 録画中: `● Recording...` を表示（赤いドット）
- 通常時: 既存の `Ready` 表示

## 操作フロー

1. ユーザーがエッジ（ストーリー）を選択する
2. Preview タブに切り替え、Toolbar の **● REC** をクリック
3. Preview ウィンドウが開き、Base URL を読み込む
4. ユーザーがページ上で操作する（クリック、入力、ページ遷移）
5. 操作がリアルタイムで DetailPanel にステップとして表示される
6. **■ Stop** をクリックして録画を終了
7. 記録されたステップは Story に保存され、▶ Run で再生可能

## 制約・Phase 2 のスコープ

### 対象アクション
- **click** — 要素クリック
- **type** — テキスト入力（input, textarea）
- **navigate** — ページ遷移（URL 変更）

### Phase 2 では対象外
- select（ドロップダウン選択）→ Phase 3
- assert（アサーション追加）→ Phase 3
- hover, drag & drop → Phase 4
- ステップの並べ替え・挿入 → Phase 4

## ファイル変更一覧

| ファイル | 変更内容 |
|---------|---------|
| `electron/main.ts` | 録画 IPC ハンドラ、CDP 接続、インジェクションスクリプト |
| `electron/preload.ts` | 新規 IPC メソッド追加 |
| `src/types.ts` | RecordedStep 型、StorywrightAPI 拡張 |
| `src/App.tsx` | 録画状態管理、recorder:step リスナー |
| `src/components/Toolbar.tsx` | REC/Stop ボタン |
| `src/components/PreviewPanel.tsx` | 録画中の表示切替 |
| `src/components/StatusBar.tsx` | 録画状態表示 |
| `src/App.css` | 録画関連スタイル |
