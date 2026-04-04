# ADR-018: Environment Requirements を表示する Settings surface

- 日付: 2026-04-04
- ステータス: アーカイブ（ADR-016 に統合）

## 要約

Settings surface を独立 ADR として維持する案は採らず、環境変数まわりの UI / diagnostics / 設定導線は ADR-016 の継続実装として扱う。

この ADR は、独立した Settings ADR を立てる案が存在したことを残すための履歴メモである。

## 統合理由

- 実装済みの Settings surface は `{{ENV.*}}` 実行基盤の延長にある
- ユーザーに見せる主概念は env source 優先順位ではなく、domain / 環境ごとの設定セットである
- requirement 可視化、Settings 導線、`.env` import はすでに ADR-016 の実装進捗に含めて追跡している

## 現在の扱い

- Settings window 自体は継続利用する
- environment requirement 仕様は ADR-016 と関連 spec で管理する
- local-only な設定値は export 対象に含めない

## 参照先

- `docs/ai/adr/ADR-016-environment-variable-support.md`
- `docs/ai/spec-settings-environment-requirements.md`