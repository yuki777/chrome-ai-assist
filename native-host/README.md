# Chrome AI Assist - Native Messaging Host

このディレクトリには、Chrome AI AssistとMCPサーバーを接続するためのNative Messaging Hostが含まれています。

## セットアップ手順

### 1. 依存関係のインストール

```bash
cd native-host
npm install
```

### 2. Chrome拡張のIDを確認

1. Chromeで `chrome://extensions/` を開く
2. 「開発者モード」を有効にする
3. Chrome AI Assist拡張を見つけ、ID（32文字の英数字）をコピー

### 3. Native Messaging Hostのインストール

```bash
./install.sh YOUR_EXTENSION_ID
```

例：
```bash
./install.sh abcdefghijklmnopqrstuvwxyz123456
```

### 4. 接続テスト（オプション）

```bash
node test-connection.js
```

## トラブルシューティング

### Native Hostが接続できない場合

1. Chrome拡張を再読み込み
2. `manifest.json`に`nativeMessaging`権限があることを確認
3. Native Hostのマニフェストファイルが正しい場所にあることを確認：
   ```
   ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.chrome_ai_assist.mcp_bridge.json
   ```

### DocBase MCPサーバーが起動しない場合

1. APIトークンが正しいことを確認
2. ドメインが正しいことを確認
3. `npx`コマンドが動作することを確認

## 動作確認

1. DocBaseのページを開く
2. Chrome AI Assist拡張のアイコンをクリック
3. デバッグパネルを開いて、MCP接続状態を確認