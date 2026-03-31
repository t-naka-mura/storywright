# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## 使い方

### 開発モードで起動

```
pnpm install
pnpm tauri dev
```

### 本番ビルド・本番相当の動作確認

```
pnpm tauri build
```
ビルド後、生成された実行ファイル（`src-tauri/target/release/` など）を直接起動してください。

### Rust未導入の場合

[Rust公式サイト](https://www.rust-lang.org/ja/tools/install) または asdf などのバージョン管理ツールで Rust をインストールしてください。
