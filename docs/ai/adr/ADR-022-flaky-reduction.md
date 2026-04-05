# ADR-022: E2E 実行の Flaky 削減

- 日付: 2026-04-05
- ステータス: 承認済み（Phase 1 実装完了）

## Context (背景)

録画した Story をそのまま Run するフローで、10〜20% 程度の flaky が残存している。リピート実行（ADR-011）で安定性を検証できるようになったことで、問題がより顕在化した。

### 現状の待機メカニズム

1. **waitForDomSettle** — MutationObserver で DOM 変更を監視し、150ms 間変更がなければ安定と判定（最大 3000ms）
2. **waitForWebContentsReady** — `document.readyState` が `interactive` or `complete` になるまで 100ms ポーリング（最大 5000ms）
3. **waitForElement** — セレクタに一致する要素が出現するまで 100ms ポーリング（最大 10000ms）

### 既知の flaky パターン

| パターン | 原因 | 頻度 |
|---------|------|------|
| click 後の assert が古い DOM を見る | React の state 更新 → re-render が DOM 変更なしに完了するケースがある | 高 |
| ページ遷移後のステップが失敗 | `readyState=complete` でも React ハイドレーション未完了 | 中 |
| リピート実行で後半が不安定 | 上記問題の累積 | 中 |

## Options (選択肢)

### Phase 1: assert のリトライ（即効性が高い）

assert ステップに短い待機 + リトライを入れる。Playwright の `expect().toPass()` に相当する仕組み。

```javascript
case 'assert': {
  var deadline = Date.now() + timeout;
  while (true) {
    var assertEl = resolveSelector(step.target);
    if (assertEl) {
      var text = assertEl.textContent || '';
      if (text.includes(step.value)) {
        return { status: 'passed' };
      }
    }
    if (Date.now() >= deadline) {
      var finalText = assertEl ? (assertEl.textContent || '') : '(element not found)';
      throw new Error('Assertion failed: expected "' + step.value + '" in "' + finalText.trim() + '"');
    }
    await new Promise(function(r) { setTimeout(r, 100); });
  }
}
```

**メリット**
- 変更が assert の case だけに閉じる
- DOM 更新の遅延をリトライで吸収できる
- 最も flaky 率が高いパターンに直撃する

**デメリット**
- 本当に失敗すべきケースのフィードバックが遅くなる（最大 10 秒待つ）
- 根本原因（待機不足）は解決しない

### Phase 2: waitForDomSettle の強化

MutationObserver に加えて、ネットワークアイドルや `requestIdleCallback` も条件に入れる。

```javascript
function waitForDomSettle(timeoutMs, quietMs) {
  // 既存の MutationObserver ロジック
  // + fetch/XHR の pending チェック
  // + requestIdleCallback で CPU アイドルも確認
}
```

**メリット**
- click/type 後の待機精度が向上
- フレームワーク非依存（React 以外でも有効）

**デメリット**
- fetch のモンキーパッチが必要（副作用のリスク）
- 対象サイトの実装によっては常にリクエストが飛んでいて待機が長引く

### Phase 3: ページ遷移後の待機強化

`waitForWebContentsReady` を `readyState` だけでなく、DOM 安定も条件に入れる。

```typescript
async function waitForWebContentsReady(wc, timeoutMs = 5000) {
  // 1. readyState が complete になるまで待つ（既存）
  // 2. さらに waitForDomSettle を実行して DOM 安定を確認（追加）
}
```

**メリット**
- ページ遷移後の flaky を直接解決
- 実装がシンプル

**デメリット**
- 遷移後の待機時間が長くなる（readyState 待ち + DOM settle）

## Decision (決定)

**Phase 1 → 2 → 3 の順で段階的に実施する。**

Phase 1（assert リトライ）が最もコストパフォーマンスが高い。既存の `waitForElement` と同様のポーリングパターンで、assert にもリトライを入れるだけで flaky の主因に対処できる。

Phase 2・3 は Phase 1 の効果を計測してから判断する。リピート実行で安定率を比較し、改善が不十分な場合に着手する。

### 実施順序

1. **Phase 1**: assert リトライ — `__storywrightExecuteStep` の `assert` case を修正
2. **計測**: リピート実行（10〜20回）で flaky 率を計測、Phase 1 前後を比較
3. **Phase 2**: 必要に応じて waitForDomSettle を強化
4. **Phase 3**: 必要に応じてページ遷移後の待機を強化

## Consequences (影響)

### メリット
- 段階的に改善できるため、各フェーズの効果を計測しやすい
- Phase 1 は最小の変更で最大の効果が見込める
- リピート実行が安定性の定量評価ツールとして機能する

### デメリット
- Phase 1 だけでは assert 以外のステップの flaky は改善しない
- 全フェーズ完了までに時間がかかる

### 影響範囲
- `electron/main.ts` — `EXECUTOR_INJECTION_SCRIPT` 内の `__storywrightExecuteStep`
- E2E テスト — flaky 率の改善により安定化（変更不要）
