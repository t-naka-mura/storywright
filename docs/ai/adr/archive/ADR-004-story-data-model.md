# ADR-004: ストーリーのデータモデルと永続化方式

- 日付: 2026-03-31
- ステータス: 承認

## Context (背景)

Storywright の中心概念は「ストーリー」である。ストーリーはステップ単位の粒度を持ち、以下のデータソースから取り込まれる:

- **Figma**: MCP経由またはスクリーンショットから画面情報を取得
- **Google Spreadsheet**: URL とテスト手順
- **手動入力**: GUI上で直接作成

ストーリーは画面/URLと紐付けられ、Playwright によるE2Eテストとして実行される。このデータモデルがUI設計・データソース連携・テスト実行すべての基盤となる。

## Options (選択肢)

### A. フラット構造（Story + Steps）

```
Story
├── id
├── title          # "ログインできる"
├── url            # テスト対象URL
├── screen         # 画面参照（Figma URL or スクリーンショットパス）
├── source         # 取り込み元 (figma | spreadsheet | manual)
├── tags[]         # 分類用タグ
├── steps[]
│   ├── order      # 実行順
│   ├── action     # 操作種別 (navigate | click | type | select | assert | wait | screenshot ...)
│   ├── target     # 操作対象 (CSS selector | text | role ...)
│   ├── value      # 入力値・期待値
│   └── description # "メールアドレスを入力する"
└── metadata
    ├── createdAt
    └── updatedAt
```

**メリット**: シンプル、実装しやすい、Spreadsheetとの相性が良い
**デメリット**: ストーリー間の関係性（前提条件、共通手順）を表現しにくい

### B. 階層構造（Suite > Story > Steps）

```
Suite
├── id
├── title          # "認証機能"
├── stories[]
│   └── Story（Aと同じ）
└── sharedSteps[]  # 共通手順（ログイン手順など）
```

**メリット**: グルーピング、共通手順の再利用が可能
**デメリット**: 複雑度が増す、初期段階ではオーバースペックの可能性

### C. グラフ構造（Story間の依存関係）

```
Story → depends_on → [other Stories]
```

**メリット**: 「ログイン」→「商品購入」のような依存チェーンを表現可能
**デメリット**: 実装・UIとも複雑度が高い

## Decision (決定)

### データモデル: A（フラット構造）で開始

JSONファイルなので、フィールド追加で後から Suite や共通手順への拡張が可能。マイグレーション不要。

```
Story
├── id
├── title          # "ログインできる"
├── url            # テスト対象URL
├── screen         # 画面参照（Figma URL or スクリーンショットパス）
├── source         # 取り込み元 (figma | spreadsheet | manual)
├── tags[]         # 分類用タグ
├── steps[]
│   ├── order      # 実行順
│   ├── action     # 操作種別
│   ├── target     # 操作対象 (CSS selector | text | role ...)
│   ├── value      # 入力値・期待値
│   └── description # 人が読める説明
└── metadata
    ├── createdAt
    └── updatedAt
```

### Step の action 種別

| action | 説明 | 例 |
|--------|------|-----|
| navigate | URLに遷移 | `{ action: "navigate", value: "https://..." }` |
| click | 要素をクリック | `{ action: "click", target: "button.submit" }` |
| type | テキスト入力 | `{ action: "type", target: "#email", value: "test@example.com" }` |
| select | プルダウン選択 | `{ action: "select", target: "#role", value: "admin" }` |
| assert | 検証 | `{ action: "assert", target: ".message", value: "ログイン成功" }` |
| wait | 待機 | `{ action: "wait", target: ".loading", value: "hidden" }` |
| screenshot | スクリーンショット取得 | `{ action: "screenshot", description: "ログイン後の画面" }` |

### 永続化方式: JSON + SQLite ハイブリッド

「共有するもの / しないもの」でストレージを分ける。

| データ | 共有 | 方式 | 理由 |
|--------|------|------|------|
| ストーリー定義 | する（Git管理、チーム共有） | JSON | 可読性、diff、レビュー可能 |
| テスト実行結果 | しない（各自のローカル） | SQLite | 蓄積・検索・フィルタに強い |
| アプリ設定 | しない | JSON | シンプルで十分 |

#### ファイル配置（案）

```
プロジェクトルート/
├── .storywright/
│   ├── stories/          # JSON — Git管理対象
│   │   ├── login.json
│   │   └── checkout.json
│   └── config.json       # アプリ設定 — Git管理対象
└── (ユーザーローカル)
    └── ~/.storywright/
        └── results.db    # SQLite — Git管理外
```

## Consequences (影響)

### メリット
- ストーリー定義がJSONなので、Git管理・チーム共有・レビューが容易
- フィールド追加で拡張でき、マイグレーション不要
- テスト実行結果はSQLiteで高速な検索・フィルタが可能
- 共有する/しないの境界が明確

### デメリット
- 2つのストレージ系を管理する実装コスト
- JSONファイルが増えた場合のパフォーマンス（数百程度なら問題なし）

### 将来の拡張パス
- Suite（グルーピング）: `stories/` 配下にディレクトリ構造を導入
- 共通手順: `stories/_shared/` に共通ステップJSONを配置し、`{ action: "ref", refId: "..." }` で参照
- これらはJSONフィールド追加で対応でき、既存データの破壊的変更は不要
