# MCP機能セットアップガイド

## 🎯 なぜこの手順が必要？

Chrome AI AssistのMCP機能を使うには、Chromeのセキュリティ仕様により「Native Messaging Host」の設定が必要です。これは以下を可能にします：

- 📄 DocBaseのドキュメントをより効率的に処理
- 🔧 GitHub、Backlogなど他のMCPサーバーとの連携
- 🚀 ローカルでの高速処理（クラウドAPIより高速）

## ⚡ 3ステップ簡単セットアップ

### ステップ1: 依存関係のインストール
```bash
cd native-host
npm install
```

### ステップ2: 拡張IDの取得
1. Chromeで `chrome://extensions/` を開く
2. Chrome AI Assist拡張を見つける
3. IDをコピー（例: `abcdefghijklmnopqrstuvwxyz123456`）

### ステップ3: 自動インストール
```bash
./auto-install.sh YOUR_EXTENSION_ID
```

## ✅ 動作確認

1. DocBaseページを開く
2. Chrome AI Assist拡張を開く
3. デバッグボタン（🐛）を押す
4. 「MCP接続状態」で「接続済み」を確認

## 🔧 トラブルシューティング

### よくある問題と解決法

**Q: "Native host has exited" エラーが出る**
A: Chromeを完全に再起動してください（Command+Q → 再起動）

**Q: 拡張IDがわからない**
A: `chrome://extensions/` で開発者モードを有効にすると見やすくなります

**Q: MCPサーバーが見つからない**
A: DocBase APIトークンが正しく設定されているか確認してください

## 🎉 MCP機能を無効にしたい場合

MCP機能は自動的に動作しますが、Native Hostがインストールされていない場合は通常通り動作します。完全に無効にしたい場合は：

```bash
rm ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.chrome_ai_assist.mcp_bridge.json
```