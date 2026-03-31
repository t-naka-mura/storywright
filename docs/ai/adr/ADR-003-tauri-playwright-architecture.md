# ADR-003: Tauri と Playwright の連携アーキテクチャ

- 日付: 2026-03-31
- ステータス: 承認

## Context (背景)

ADR-002 で Playwright の採用が決定した。Storywright は Tauri (Rust) デスクトップアプリであり、フロントエンドは React (TypeScript)。一方 Playwright は Node.js ライブラリである。

Tauri アプリから Playwright を実行するためのアーキテクチャを決定する必要がある。

## Options (選択肢)

### A. サイドカー方式（Tauri Sidecar + Node.js プロセス）

```
[React UI] ←IPC→ [Tauri Rust] ←Sidecar→ [Node.js + Playwright]
```

Tauri の Sidecar 機能で Node.js プロセスを子プロセスとして起動し、Playwright を実行する。Rust ↔ Node.js 間は stdin/stdout や WebSocket で通信。

**メリット**:
- Playwright の全機能をそのまま使える
- Node.js エコシステム（Playwright プラグイン等）がフル活用可能
- テスト実行ロジックを TypeScript で書ける（フロントエンドと言語統一）

**デメリット**:
- Node.js ランタイムの同梱が必要（アプリサイズ増加）
- プロセス間通信の設計・管理が必要
- Sidecar プロセスのライフサイクル管理

### B. Rust から直接ブラウザ制御（chromiumoxide / fantoccini）

```
[React UI] ←IPC→ [Tauri Rust + chromiumoxide/fantoccini]
```

Rust のブラウザ自動化ライブラリで CDP (Chrome DevTools Protocol) を直接制御。

**メリット**:
- Node.js 不要、アプリサイズが小さい
- プロセス間通信が不要（Rust 内で完結）

**デメリット**:
- Playwright の高レベルAPI（自動待機、ロケーター等）が使えない
- マルチブラウザ対応が困難（CDPはChromium系のみ）
- テスト記述をRustで行う必要があり、ストーリーからの動的テスト生成が複雑
- ADR-002 の Playwright 採用と矛盾

### C. Embedded Node.js（Tauri プロセス内に Node.js を組み込み）

```
[React UI] ←IPC→ [Tauri Rust ←embedded→ Node.js + Playwright]
```

napi-rs や deno_core などで Rust プロセス内に JS ランタイムを組み込む。

**メリット**:
- 単一プロセスで完結
- IPC が不要で通信オーバーヘッドがない

**デメリット**:
- 技術的に複雑（Playwright が組み込みランタイムで動く保証がない）
- デバッグが困難
- 実績が少なくリスクが高い

## Decision (決定)

**A. サイドカー方式を採用する。**

```
[React UI] ←IPC→ [Tauri Rust] ←Sidecar→ [Node.js + Playwright]
                                              ↓
                                     [システムブラウザ]
```

- Node.js 同梱は許容する（ブラウザバイナリ比で相対的に小さい）
- テストロジックを TypeScript で書ける（フロントエンドと言語統一）
- Playwright の全機能をフル活用できる
- ブラウザは同梱せず、システムブラウザを `channel` オプションで利用（ADR-002）
- 非エンジニアでもインストールするだけで使える体験を維持

## Consequences (影響)

### メリット
- Playwright の高レベルAPI（自動待機、ロケーター、マルチブラウザ）がそのまま使える
- テスト実行ロジックが TypeScript で統一され、フロントエンドと同じ言語で開発できる
- Tauri Sidecar は公式機能であり、実績がある

### デメリット
- Node.js ランタイム同梱によりアプリサイズが約 40-80MB 増加
- Rust ↔ Node.js 間のプロセス間通信の設計・実装が必要
- Sidecar プロセスのライフサイクル管理が必要

### 今後の検討事項
- Rust ↔ Node.js 間の通信プロトコル（stdin/stdout JSON-RPC? WebSocket?）
- Sidecar の起動・停止・エラーハンドリングの設計
- Node.js バイナリのバンドル方法（pkg? Node.js SEA?）
