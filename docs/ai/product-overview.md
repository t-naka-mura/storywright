# Storywright プロダクト概要

## ビジョン

ユーザーストーリーの作成からE2Eテストの実行までを一気通貫で行えるデスクトップアプリケーション。非エンジニアでもインストールするだけで使える。

## 解決したい課題

- ユーザーストーリーが散在し、テストケースとの紐付けが不明確になりがち
- Figma上のデザインやスプレッドシート上の要件が、テストと直接結びついていない
- E2Eテストの作成・管理が開発者に閉じており、非エンジニアとの協業が難しい

## コンセプト

1. **ストーリーの取り込み**: Google Spreadsheet からインポート、またはGUI上で手動作成
2. **画面・URLとの紐付け**: GUI上でストーリーをFigmaの画面デザインやURLに関連付け
3. **E2Eテストの実行**: ストーリーのステップに基づいてシステムブラウザでテストを実施
4. **結果の管理**: テスト実行結果をローカルに蓄積、検索・フィルタ可能

## アーキテクチャ

```
[React UI] ←IPC→ [Tauri Rust] ←Sidecar→ [Node.js + Playwright]
                                              ↓
                                     [システムブラウザ]
```

## 技術スタック

| レイヤー | 技術 | ADR |
|---------|------|-----|
| デスクトップ | Tauri 2 | — |
| フロントエンド | React 19 + TypeScript + Vite | — |
| バックエンド | Rust (Tauri) | — |
| E2Eテスト | Playwright（システムブラウザ利用） | ADR-002 |
| Tauri ↔ Playwright 連携 | Sidecar方式（Node.js同梱） | ADR-003 |
| データソース | Google Sheets API, Figma MCP/API | ADR-005 |

## データモデル（ADR-004）

### ストーリー定義（JSON — Git管理・チーム共有）

```
Story
├── id, title, url, screen, source, tags[]
├── steps[]
│   ├── order, action, target, value, description
└── metadata (createdAt, updatedAt)
```

**action 種別**: navigate / click / type / select / assert / wait / screenshot

### 永続化

| データ | 方式 | 共有 |
|--------|------|------|
| ストーリー定義 | JSON（`.storywright/stories/`） | Git管理 |
| テスト実行結果 | SQLite（`~/.storywright/results.db`） | ローカルのみ |
| アプリ設定 | JSON（`.storywright/config.json`） | Git管理 |

## データソース連携（ADR-005）

### フェーズ別スコープ

| フェーズ | Spreadsheet | Figma |
|---------|-------------|-------|
| **v1** | インポート → 手動マッピング | URLリンク + スクリーンショット参照 |
| **v2** | AI変換提案 → ユーザー確認・修正 | MCP経由デザイン情報 + AI変換提案 |
| **v3** | — | Figma Plugin → ストーリー自動生成 |

## 現在のステータス

- **フェーズ**: 設計段階（ADR策定中）
- **UI**: 未確定（次の検討事項）
- **コード**: Tauri + React のスキャフォールディング済み

## 今後検討が必要な事項

- [x] UI/UXの設計方針 → ADR-006 + design-philosophy.md
- [ ] Rust ↔ Node.js 間の通信プロトコル設計
- [ ] Google Sheets API の認証方式
- [ ] Spreadsheet の列マッピングUIの設計
- [ ] v2 のAI変換に使うLLMの選定

## 関連ドキュメント

- [docs/ai/index.md](index.md) — docs/ai 運用ガイド
- [ADR-001](adr/ADR-001-document-driven-development.md) — ドキュメント駆動開発
- [ADR-002](adr/ADR-002-e2e-test-framework.md) — E2Eテストフレームワーク選定
- [ADR-003](adr/ADR-003-tauri-playwright-architecture.md) — Tauri × Playwright アーキテクチャ
- [ADR-004](adr/ADR-004-story-data-model.md) — データモデルと永続化方式
- [ADR-005](adr/ADR-005-data-source-integration.md) — データソース連携のスコープ
- [ADR-006](adr/ADR-006-ui-architecture.md) — UI/UXアーキテクチャ
- [ADR-007](adr/ADR-007-canvas-interaction.md) — キャンバス操作とステップ編集
- [ADR-008](adr/ADR-008-test-execution-and-persistence.md) — テスト実行・結果表示・永続化
- [design-philosophy.md](design-philosophy.md) — デザイン思想
