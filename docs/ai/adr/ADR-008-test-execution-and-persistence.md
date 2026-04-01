# ADR-008: テスト実行・結果表示・永続化

- 日付: 2026-04-01
- ステータス: 提案

## Context (背景)

ADR-007 でキャンバス上のストーリー作成・ステップ編集の仕様が定まる。本 ADR では、作成したストーリーをどのように実行し、結果をどう表示・保存するかを決定する。

### 前提

- テスト実行は Tauri Sidecar 経由で Node.js + Playwright（ADR-003）
- ストーリー定義は JSON（ADR-004）
- テスト結果は SQLite にローカル保存（ADR-004）
- キャンバスUIは React Flow（ADR-006）

## Decision (決定)

### 1. テスト実行フロー

```
[ユーザー操作]
    │
    ├─ 単体実行: エッジ選択 → Detail Panel「▶ Run」
    ├─ 一括実行: Toolbar「▶ Run All」
    │
    ▼
[React UI] ── IPC ──→ [Tauri Rust]
                           │
                           ├─ ストーリー JSON を読み込み
                           ├─ Sidecar 起動（未起動なら）
                           │
                           ▼
                      [Node.js + Playwright]
                           │
                           ├─ ステップを順次実行
                           ├─ 各ステップの結果を逐次返却
                           │
                           ▼
                      [Tauri Rust] ── IPC ──→ [React UI]
                           │                      │
                           ▼                      ▼
                      [SQLite 保存]           [リアルタイム表示]
```

#### 実行単位

| 操作 | 対象 | ボタン位置 |
|------|------|-----------|
| 単一ストーリー実行 | 選択中のエッジ（ストーリー） | Detail Panel |
| 全ストーリー実行 | キャンバス上の全エッジ | Toolbar |

#### 実行制御

- **中断**: 実行中に「■ Stop」ボタンで停止（Playwright プロセスを kill）
- **再実行**: 失敗したストーリーだけを再実行する「▶ Re-run Failed」
- **並列実行は v1 では行わない**: ストーリーを順次実行（シンプルさ優先）

### 2. リアルタイム結果表示

#### キャンバス上の表示（design-philosophy.md 準拠）

| 状態 | エッジ表示 | ノード表示 |
|------|-----------|-----------|
| 未実行 | グレー（デフォルト） | 変化なし |
| 実行中 | アクセント色 + 光の粒アニメーション | — |
| 成功 | 緑 | 一瞬パルスして緑に光る |
| 失敗 | 赤 | 軽くシェイク + 赤ハイライト |
| 全テスト通過 | — | キャンバス全体に控えめな祝福エフェクト |

#### Detail Panel のステップ表示

```
① navigate  /login           ✓  200ms
② type  #email → test@...    ✓  150ms
③ click  .submit             ✗  Error: Element not found
   └─ [スクリーンショット表示]
④ assert  .title → "..."     ⏸  (未実行)
```

- 各ステップに結果アイコン（✓ / ✗ / ⏸）と実行時間を表示
- 失敗ステップはエラーメッセージを展開表示
- screenshot action、または失敗時の自動スクリーンショットをインライン表示

#### Status Bar

```
▶ 実行中: 2/5 ストーリー完了  |  成功: 1  失敗: 1  |  経過時間: 00:12
```

### 3. テスト結果の永続化

#### SQLite スキーマ（ADR-004 の方針に基づく）

```sql
-- テスト実行セッション
CREATE TABLE test_runs (
  id          TEXT PRIMARY KEY,   -- UUID
  started_at  TEXT NOT NULL,      -- ISO 8601
  finished_at TEXT,
  status      TEXT NOT NULL,      -- running | passed | failed | stopped
  total       INTEGER NOT NULL,
  passed      INTEGER NOT NULL DEFAULT 0,
  failed      INTEGER NOT NULL DEFAULT 0
);

-- ストーリー単位の結果
CREATE TABLE story_results (
  id           TEXT PRIMARY KEY,
  run_id       TEXT NOT NULL REFERENCES test_runs(id),
  story_id     TEXT NOT NULL,      -- Story.id（JSON側）
  story_title  TEXT NOT NULL,
  status       TEXT NOT NULL,      -- passed | failed | skipped
  duration_ms  INTEGER,
  error        TEXT                -- 失敗時のエラーメッセージ
);

-- ステップ単位の結果
CREATE TABLE step_results (
  id              TEXT PRIMARY KEY,
  story_result_id TEXT NOT NULL REFERENCES story_results(id),
  step_order      INTEGER NOT NULL,
  action          TEXT NOT NULL,
  target          TEXT,
  value           TEXT,
  status          TEXT NOT NULL,    -- passed | failed | skipped
  duration_ms     INTEGER,
  error           TEXT,
  screenshot_path TEXT              -- スクリーンショットのファイルパス
);
```

#### 保存場所

```
~/.storywright/
├── results.db              # SQLite
└── screenshots/            # 失敗時・screenshot action のキャプチャ
    └── {run_id}/
        └── {story_id}_{step_order}.png
```

### 4. ストーリー定義の永続化（自動保存）

| イベント | 動作 |
|---------|------|
| ノード追加/編集/削除 | キャンバス状態を JSON に自動保存（デバウンス 1秒） |
| エッジ追加/編集/削除 | 同上 |
| ステップ追加/編集/削除 | 対象ストーリーの JSON を自動保存 |
| 保存完了 | Status Bar にチェックマーク表示 → フェードアウト |

#### 保存形式（ADR-004 準拠）

```
.storywright/
├── stories/
│   ├── login-flow.json       # ストーリー単位のJSON
│   └── signup-flow.json
├── canvas.json               # ノード配置情報（position, viewport）
└── config.json               # アプリ設定
```

`canvas.json` はストーリーのデータモデルには含まれないレイアウト情報（ノードの座標、ビューポート位置）を保持する。

### 5. 結果履歴の閲覧

- Status Bar の「最終実行」表示をクリック → 過去の実行履歴一覧を表示
- 各実行の詳細（ストーリー別の成否、失敗ステップ、スクリーンショット）を閲覧可能
- v1 ではシンプルなリスト表示、v2 以降でトレンドグラフ等を検討

## Consequences (影響)

### メリット
- リアルタイムのステップ進捗表示により、テスト実行状況が常に把握できる
- 自動保存により、ユーザーが明示的に保存する必要がない
- SQLite + スクリーンショット保存で、失敗原因の事後調査が容易
- design-philosophy.md のマイクロインタラクション仕様と整合

### デメリット
- Rust ↔ Node.js 間のリアルタイム通信（ステップ単位の逐次結果返却）の実装コスト
- 自動保存のデバウンス設計が不適切だとパフォーマンス問題
- スクリーンショットの蓄積によるディスク使用量の管理が必要

### 実装の優先順位（提案）

1. **Phase 1**: ストーリー定義の自動保存（JSON）+ canvas.json
2. **Phase 2**: テスト実行（単一ストーリー）+ 結果の SQLite 保存
3. **Phase 3**: リアルタイム表示（エッジ色変え、ステップ進捗）
4. **Phase 4**: 全ストーリー実行、結果履歴、再実行
