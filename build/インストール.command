#!/bin/bash
# Storywright インストールスクリプト
# ダブルクリックで実行してください

APP_NAME="Storywright"
APP_PATH="/Applications/${APP_NAME}.app"
DMG_APP="$(dirname "$0")/${APP_NAME}.app"

echo "==================================="
echo "  ${APP_NAME} インストーラー"
echo "==================================="
echo ""

# dmg 内の .app を Applications にコピー
if [ -d "$DMG_APP" ]; then
  echo "📦 ${APP_NAME} を Applications にコピーしています..."
  cp -R "$DMG_APP" /Applications/ 2>/dev/null
  if [ $? -ne 0 ]; then
    echo "❌ コピーに失敗しました。既にアプリが開いている場合は閉じてから再実行してください。"
    echo ""
    read -p "Enter キーを押して終了..."
    exit 1
  fi
else
  if [ ! -d "$APP_PATH" ]; then
    echo "❌ ${APP_NAME}.app が見つかりません。"
    echo "   先に dmg 内の ${APP_NAME} を Applications フォルダにドラッグしてください。"
    echo ""
    read -p "Enter キーを押して終了..."
    exit 1
  fi
fi

# quarantine 属性を解除
echo "🔓 セキュリティ制限を解除しています..."
xattr -cr "$APP_PATH"

# アプリを起動
echo "🚀 ${APP_NAME} を起動しています..."
open "$APP_PATH"

echo ""
echo "✅ 完了しました！このウィンドウは閉じて大丈夫です。"
echo ""
read -p "Enter キーを押して終了..."
