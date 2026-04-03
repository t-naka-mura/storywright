<p align="center">
  <img src="public/logo.svg" alt="Storywright" width="96" />
</p>

# Storywright

ブラウザ操作を録画して、そのまま E2E テストとして実行できる Electron デスクトップアプリ。

## スタック

- **フロントエンド**: React 19 + TypeScript + Vite
- **バックエンド**: Electron (Node.js)
- **E2Eテスト**: CDP (Chrome DevTools Protocol) で Preview webview 上に直接実行
- **パッケージマネージャ**: pnpm

## セットアップ

```bash
pnpm install
```

## 開発モードで起動

```bash
pnpm dev
```

Vite の開発サーバーと Electron が同時に起動します。

## 本番ビルド

```bash
pnpm build
```

## プロジェクト構成

```
src/           # React フロントエンド
electron/      # Electron main process + preload
docs/ai/       # 設計ドキュメント・仕様・ADR
public/        # 静的アセット
```

## 推奨エディタ

- [VS Code](https://code.visualstudio.com/)
