# ADR-024: Import/Export ボタンを Settings ウィンドウへ移動

- 日付: 2026-04-05
- ステータス: 完了

## Context (背景)

ヘッダー Toolbar に Import / Export All ボタンが配置されているが、これらは日常的に使う操作ではない。ヘッダーをシンプルに保つため、既存の Settings ウィンドウに移動したい。

現状のヘッダー: `Import | Export All | REC | ? | □`

## Decision (決定)

Import / Export All を Toolbar から削除し、Settings ウィンドウに「ストーリーデータ」セクションとして追加する。

### 変更後のヘッダー

`REC | ? | ⚙ | □`

### Settings ウィンドウへの追加

既存の環境変数セクションの下に「ストーリーデータ」セクションを追加:
- **Import** ボタン — ファイル選択→ストーリーをマージ
- **Export All** ボタン — 全ストーリーを JSON ファイルに保存

### 実装方針

Settings は別 BrowserWindow のため、stories データへのアクセスに IPC が必要:

1. **Export**: Settings → IPC → メインプロセスが親ウィンドウに `stories:request-export` を送信 → 親ウィンドウが既存ロジックで Export 実行
2. **Import**: Settings → IPC → メインプロセスが親ウィンドウに `stories:request-import` を送信 → 親ウィンドウが既存ロジックで Import 実行

メインプロセスを中継役とし、親ウィンドウの既存ハンドラをそのまま再利用する。

### 変更対象ファイル

- `src/components/Toolbar.tsx` — Import / Export All ボタン削除
- `src/components/SettingsPanel.tsx` — ストーリーデータセクション追加
- `src/App.tsx` — IPC リスナー追加（`stories:request-export` / `stories:request-import`）
- `electron/main.ts` — IPC ハンドラ追加（Settings → 親ウィンドウへの中継）
- `electron/preload.ts` — API 追加
- `src/components/HelpPanel.tsx` — Import/Export の操作手順を Settings 経由に更新
- `docs/ai/product-overview.md` — 機能説明を更新

## Consequences (結果)

- ヘッダーが 5→3 ボタンになり、視覚的にすっきりする
- Import/Export は Settings を開く 1 ステップ増えるが、頻度が低いため許容範囲
- Settings ウィンドウが「環境変数 + データ管理」の統合設定画面になる
