# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Chrome AI Assist - WebページのコンテンツをAIと共有して対話できるChrome拡張機能

## アーキテクチャ

### コンポーネント間の通信フロー
```
Webページ → Content Script → Background Service Worker → AI API
    ↑                ↓                    ↓            ↗
    └─── Sidebar UI ←─────────────────────┘            ↑
                                                      ↑
                                         Native Host ←┘
                                              ↓
                                         MCP Server
```

### 主要コンポーネントの役割

1. **Background Service Worker** (`src/background/background.js`)
   - 全メッセージの中継ハブ
   - AI API呼び出し（AWS Bedrock、OpenAI、Anthropic）
   - AWS署名v4実装を含む

2. **Content Script** (`src/content/content.js`)
   - ページコンテンツの抽出（`extractPageContent()`）
   - サイドバーiframeの管理
   - フローティングボタンの制御

3. **Sidebar** (`src/sidebar/sidebar.js`)
   - チャットUIの管理
   - メッセージ履歴の永続化（1ヶ月保持）
   - Content Scriptとの双方向通信
   - MCP機能の制御とデバッグ情報表示

4. **Native Host** (`native-host/host.js`)
   - Chrome拡張機能とMCPサーバー間の橋渡し
   - Native Messaging APIによる通信
   - MCPクライアント（StdioClientTransport）の管理

5. **MCP Client** (`src/background/mcpClient.js`)
   - Native Hostとの通信管理
   - MCPメッセージの送受信とエラーハンドリング

## 開発方法

1. Chrome拡張機能の開発者モードを有効化
2. 「パッケージ化されていない拡張機能を読み込む」でプロジェクトフォルダを選択
3. 変更後は拡張機能を再読み込み

## 重要な実装パターン

### メッセージパッシング
- Content Script → Background: `chrome.runtime.sendMessage`
- Background → Content Script: `chrome.tabs.sendMessage`
- Content Script ↔ Sidebar: `window.postMessage`（iframeの制約のため）

### ストレージ
- API設定: `chrome.storage.local`
- チャット履歴: `chrome.storage.local`（`chatHistory_`プレフィックス）

### セキュリティ考慮事項
- APIキーはローカルストレージに保存
- プロンプトインジェクション対策実装済み
- CSPヘッダー設定済み

## MCP (Model Context Protocol) サポート

### MCPアーキテクチャ
Chrome拡張機能は、Chrome Native Messaging APIを通じてローカルのMCPサーバーと通信できます。

### サポート状況
- ✅ **DocBase MCP Server** - DocBaseページの詳細情報取得、投稿検索
- 🔄 **GitHub MCP Server** (計画中)
- 🔄 **Backlog MCP Server** (計画中)

### MCP機能の動作フロー
1. DocBaseページを開くとMCP処理が自動的にトリガー
2. Native HostがDocBase MCPサーバーに接続
3. 利用可能なツールを取得（getPost, searchPosts等）
4. ページURLから投稿IDを抽出
5. MCPツールで詳細情報を取得
6. サイドバーに取得した情報を表示

### Native Messaging設定
- マニフェスト: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.chrome_ai_assist.mcp_bridge.json`
- ホスト実行ファイル: `native-host/host.js`
- 切り替えスクリプト: `native-host/switch-host.sh` (mock/simple/real版の切り替え)

### セキュリティ設定
MCPサーバーのAPIトークンは以下の方法で安全に管理：
```javascript
// 環境変数から読み込み（推奨）
DOCBASE_API_TOKEN: process.env.DOCBASE_API_TOKEN

// または設定ファイルから読み込み
DOCBASE_API_TOKEN: config.docbaseToken
```