# ADR-009: Electron 移行とインタラクティブレコーダー

- 日付: 2026-04-01
- ステータス: 承認

## Context (背景)

### Tauri での開発で顕在化した課題

ADR-003 で Tauri + Sidecar 方式を採用したが、実装を進める中で以下の課題が顕在化した。

1. **Playwright 連携の複雑さ**: Rust から Node.js の Sidecar を起動し、stdin/stdout で JSON をやり取りする必要がある。Playwright は Node.js ライブラリであり、Rust を介する必然性がない
2. **Preview 表示の困難**: Tauri のマルチ WebView 機能でアプリ内にサイトを埋め込む試みが失敗。iframe も X-Frame-Options でブロックされ、結局 WebviewWindow（別ウィンドウ）に頼らざるを得なかった
3. **開発速度の低下**: Rust のコンパイル時間、Rust ↔ JSON ↔ TypeScript の3層シリアライゼーション、asdf 環境での PATH 問題など、開発体験を阻害する要因が多い
4. **コードの大半が TypeScript**: Rust で書いたのは約100行のブリッジコードのみ。アプリのロジックは全て TypeScript で、Rust が仲介する構造にメリットがない

### インタラクティブレコーダーの必要性

E2E テストの最大の障壁は「CSS セレクタの指定」である。`button.submit` や `#email` のようなセレクタは、エンジニアでも面倒で、非エンジニアには壁が高い。

Playwright の Codegen（レコーダー）のように、ブラウザ上で要素をクリックするだけでセレクタを自動取得し、ステップとして記録できれば、非エンジニアでもテストを作成できる。これは Storywright の最大の差別化ポイントになり得る。

この機能を実現するには、アプリ内にプレビュー用ブラウザを埋め込み、CDP（Chrome DevTools Protocol）でイベントをインターセプトする必要がある。Electron はこれが容易だが、Tauri では困難。

## Options (選択肢)

### A. Tauri のまま継続

- Sidecar 方式で Playwright を実行し続ける
- Preview は別ウィンドウ（WebviewWindow）で妥協
- インタラクティブレコーダーは Tauri の制約内で工夫する

**メリット**: 移行コスト不要
**デメリット**: Preview のアプリ内埋め込みが困難、レコーダーの実装が複雑、開発速度が遅い

### B. Electron に移行

- Electron の main process で Playwright を直接実行
- BrowserWindow でプレビューをアプリ内に埋め込み
- CDP 経由でインタラクティブレコーダーを実装

**メリット**: 全て TypeScript で統一、Playwright 直接実行（Sidecar 不要）、Preview 埋め込みが容易、レコーダー実装が自然
**デメリット**: バンドルサイズが大きい（Electron ランタイム含む）、メモリ使用量が多い

### C. Electron + Playwright のレコーダー API を活用

B に加え、Playwright 公式のレコーダー機能（`page.pause()` や Inspector API）を流用する。

**メリット**: B のメリット + レコーダーの実装コストが下がる
**デメリット**: Playwright レコーダーの API が公開されていない部分がある、カスタマイズ性が限定的

## Decision (決定)

**B. Electron に移行する。** レコーダーの実装方式は B をベースに、C の要素を取り入れ可能か調査する。

### 移行による変更

| 項目 | Tauri（現行） | Electron（移行後） |
|------|-------------|------------------|
| デスクトップフレームワーク | Tauri 2 (Rust) | Electron |
| バックエンド言語 | Rust | TypeScript (Node.js) |
| Playwright 連携 | Sidecar + stdin/stdout IPC | main process で直接 import |
| Preview | WebviewWindow（別ウィンドウ） | BrowserWindow（アプリ内管理） |
| フロントエンド | React + TypeScript + Vite | React + TypeScript + Vite（変更なし） |
| IPC | Tauri invoke | Electron ipcMain / ipcRenderer |

### 移行対象

| 対象 | 作業 |
|------|------|
| **再利用（変更なし）** | React コンポーネント、CSS、型定義、ADR・設計ドキュメント |
| **軽微な変更** | `invoke()` → `ipcRenderer.invoke()` に置き換え |
| **新規作成** | Electron main process（run_story, preview 管理） |
| **削除** | src-tauri/ 配下全体、runner/run.mjs（main process に統合） |

### インタラクティブレコーダーの構想

```
┌────────────────────────────────────────────────┐
│ Toolbar                          [● REC] [■ Stop] │
├──────────────────────┬─────────────────────────┤
│                      │ Detail Panel             │
│   Preview            │                         │
│   (BrowserWindow)    │ ① click  button.submit  │ ← 自動記録
│                      │ ② type   #email         │ ← 自動記録
│   ユーザーが実際に    │ ③ ...                   │
│   サイトを操作する    │                         │
│                      │ [Save as Story]          │
├──────────────────────┴─────────────────────────┤
│ Status Bar                ● Recording...        │
└────────────────────────────────────────────────┘
```

#### 動作フロー

1. ユーザーが「REC」ボタンを押す
2. Preview ウィンドウが記録モードに入る
3. ユーザーがページ上の要素をクリック・入力・遷移すると、CDP 経由で操作をキャプチャ
4. キャプチャした操作がリアルタイムで Detail Panel にステップとして表示される
5. 「Stop」で記録終了、ステップ一覧がストーリーとして保存可能

#### セレクタ生成戦略

| 優先度 | 戦略 | 例 |
|--------|------|-----|
| 1 | data-testid 属性 | `[data-testid="login-button"]` |
| 2 | role + accessible name | `role=button[name="ログイン"]` |
| 3 | テキストコンテンツ | `text="ログイン"` |
| 4 | id 属性 | `#login-btn` |
| 5 | CSS セレクタ（フォールバック） | `form > button.primary` |

Playwright のロケーター戦略と整合させ、安定性の高いセレクタを優先する。

#### 実装フェーズ

1. **Phase 1**: Electron 移行（Preview のアプリ内表示、Playwright 直接実行）
2. **Phase 2**: 記録モード基本機能（click / type / navigate の記録）
3. **Phase 3**: セレクタ生成の最適化、assert の対話的追加
4. **Phase 4**: 記録の編集・再生・微調整

## Consequences (影響)

### メリット
- 全コードが TypeScript で統一され、開発速度が大幅に向上
- Sidecar の仕組みが不要になり、アーキテクチャがシンプルに
- Preview のアプリ内表示が可能になり、UX が向上
- インタラクティブレコーダーの実装が技術的に自然
- 非エンジニアがセレクタを知らなくてもテストを作成可能に（最大の差別化）

### デメリット
- Electron のバンドルサイズ（約 150-200MB）が Tauri（約 10-20MB）より大きい
- メモリ使用量が増加（ただしテストツールとしては許容範囲）
- ADR-003（Tauri + Sidecar）が廃止となる

### 影響を受ける既存 ADR

| ADR | 影響 |
|-----|------|
| ADR-003 | **廃止** — Tauri + Sidecar 方式を Electron に置き換え |
| ADR-006 | 変更なし — React Flow + ハイブリッド UI はそのまま |
| ADR-007 | 変更なし — キャンバス操作仕様はそのまま |
| ADR-008 | 軽微な変更 — テスト実行の仕組みが Sidecar → main process 直接に |
