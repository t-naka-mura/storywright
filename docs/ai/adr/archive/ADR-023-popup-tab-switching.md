# ADR-023: Popup ウィンドウの録画・再生対応

- 日付: 2026-04-05
- ステータス: 完了

## Context (背景)

ADR-013 により、`window.open` / `target="_blank"` で開かれる popup は新しい Preview タブとして自動管理されている。録画中に popup が開くと recorder も自動注入され、popup 内の click/type 等はキャプチャされる。

しかし、以下の2点が未対応のため popup シナリオの E2E テストが成立しない:

1. **録画時**: タブ切り替え（「どのタブで操作しているか」）が Step として記録されない
2. **再生時**: 実行エンジンは常にアクティブタブの webContents で操作するため、popup タブへの切り替え指示ができない

### ユースケース: PayPal popup ログイン

```
1. メインページで「PayPal で支払う」ボタンをクリック
2. PayPal ログイン popup が開く
3. popup 内でメール・パスワードを入力して送信
4. popup が閉じる（または自動的にメインに戻る）
5. メインページで決済完了を確認（assert）
```

## Options (選択肢)

### A. 暗黙的タブ追跡（各ステップにタブ情報を付与）

録画時に各ステップがどの webContents から発信されたかを記録し、再生時に自動的に正しいタブに切り替える。

**録画側の変更:**
- `recorder:step` の送信時に webContents の URL origin を付与
- Step に `tabUrl?: string` フィールドを追加

**再生側の変更:**
- 各ステップ実行前に `step.tabUrl` と現在のアクティブタブの URL を比較
- 異なる場合は `previewTabs` から URL が一致するタブを探して activate

**メリット**
- ユーザーはタブ切り替えを意識しなくてよい
- 既存の Step UI に影響が少ない

**デメリット**
- URL ベースのマッチングは同一 origin のタブが複数ある場合に曖昧
- Step の `tabUrl` が暗黙的で、ユーザーが Story を読んだときにタブ切り替えが見えない

### B. 明示的 `activate-tab` ステップ

タブ切り替えを専用の Step アクションとして記録する。

**録画側の変更:**
- アクティブタブが変わったとき（popup が開いてフォーカスを得た、ユーザーがタブをクリックした）に `activate-tab` ステップを自動挿入
- `activate-tab` の target はタブの URL

**再生側の変更:**
- `activate-tab` ステップで `previewTabs` から URL が一致するタブを探して activate
- 一致するタブがなければ一定時間ポーリング（popup がまだ開いていない場合に対応）

**Step 型の拡張:**
```typescript
action: "navigate" | "click" | "type" | "select" | "assert" | "wait" | "screenshot" | "activate-tab";
```

**メリット**
- Story のステップを読めばタブ切り替えが明示的に分かる
- ステップ編集で任意の位置にタブ切り替えを挿入できる
- 同一 origin のタブが複数あっても、記録順で区別可能

**デメリット**
- Step 型の拡張が必要
- 実行エンジンに新しい case を追加

### C. ハイブリッド（B の簡易版）

popup が開いたタイミングで自動的に `activate-tab` ステップを挿入し、popup が閉じたら元のタブへの `activate-tab` を挿入する。ユーザーの手動タブ切り替えは無視する。

**メリット**
- 最小限の実装で popup シナリオをカバー
- ユーザーの操作は不要（自動挿入）

**デメリット**
- 手動でタブを切り替えるケースには対応できない
- popup → popup の連鎖には追加対応が必要

## Decision (決定)

**案 B を採用。**

明示的な `activate-tab` ステップにより、Story の可読性が高く、ステップ編集でも扱いやすい。実装コストは案 A と大差ない。

### 実装方針

#### Phase 1: 録画側（activate-tab ステップの自動挿入）

1. `activePreviewTabId` が変わったときに `activate-tab` ステップを自動送信
2. `activate-tab` の target はタブの URL（フルURL）
3. 録画開始時のタブは基準タブとし、activate-tab は発行しない

**変更箇所:**
- `electron/main.ts`: `activatePreviewTab()` 内で、録画中なら `recorder:step` を送信
- `electron/main.ts`: popup の `registerPreviewTab(activate=true)` 時も同様

#### Phase 2: 再生側（activate-tab の実行）

1. `runStoryOnWebview` のステップループに `activate-tab` case を追加
2. `previewTabs` から URL が一致するタブを探して activate
3. 一致するタブがなければ最大 10 秒ポーリング（popup がまだ開いていない場合）
4. **ポーリングでもタブが見つからない場合は skip（passed 扱い）** — 2回目以降のリピート実行でログイン済み session が残り popup が出ないケースに対応
5. activate 後にエンジンを再注入

**popup が開かない場合の挙動:**

リピート実行（keepSession=true）で「初回は PayPal popup ログインが必要だが、2回目以降はセッション維持で popup がスキップされる」ケースを想定する。

- `activate-tab` でタブが見つからない → skip（passed 扱い）
- 後続の popup 内操作ステップ（click/type 等）もタブが存在しないため → skip
- メインタブに戻る `activate-tab` は元のタブが存在するため → 正常に activate
- メインタブの assert は通常通り実行

これにより、popup の有無に関わらず Story が成立する。

**skip 判定のルール:**
- `activate-tab` のタブが見つからない → skip、以降のステップは「タブが存在しない間」skip
- 次の `activate-tab` で存在するタブに切り替わったら → 通常実行を再開

**変更箇所:**
- `electron/main.ts`: `runStoryOnWebview` に `activate-tab` ケースを追加
- `src/types.ts`: Step の action に `"activate-tab"` を追加

#### Phase 3: E2E テスト

1. fixture site に popup 関連エンドポイントを追加:
   - `/checkout-popup`: 「PayPal で支払う」ボタンがあるページ。ログイン済みなら popup を開かずに直接決済完了
   - `/popup-paypal`: `window.open` で開かれる popup。ログインフォーム → 送信で `window.opener.postMessage` + `window.close()`
2. E2E テスト:
   - **popup-recording.spec.ts**: popup を含む操作を録画 → Run で全ステップ pass を検証
   - **popup-repeat.spec.ts**: keepSession=true でリピート実行。初回は popup ログインあり、2回目は popup なしで assert が pass することを検証

**変更箇所:**
- `e2e/helpers/app.ts`: fixture site にエンドポイント追加
- `e2e/popup-recording.spec.ts`: 新規テスト
- `e2e/popup-repeat.spec.ts`: 新規テスト

## Consequences (影響)

### メリット
- PayPal popup ログインのような実際のユースケースをテスト可能に
- Story のステップが明示的で可読性が高い
- 既存のタブ管理基盤（ADR-013）をそのまま活用

### デメリット
- Step 型に新しい action が追加される（既存データとの互換性に注意）
- URL ベースのタブマッチングは、同じ URL のタブが複数開いている場合に最初のマッチを使う

### 影響範囲
- `electron/main.ts` — 録画時の activate-tab 自動挿入 + 再生時の activate-tab 実行
- `src/types.ts` — Step action 型の拡張
- `e2e/helpers/app.ts` — fixture site のエンドポイント追加
- `e2e/popup-recording.spec.ts` — 新規 E2E テスト
