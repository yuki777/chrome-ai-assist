# Tech Context: Chrome AI Assist

## 技術スタック

### Chrome拡張機能
- **Manifest Version**: V3 (最新仕様)
- **コア技術**: HTML, CSS, JavaScript (Vanilla JS)
- **アーキテクチャ**: Service Worker + Content Scripts + UI Components + Native Messaging
- **MCP統合**: Model Context Protocol対応によるローカルツール連携

### 構成要素
1. **Background (Service Worker)**: `src/background/background.js`
   - バックグラウンド処理
   - AI API通信管理
   - 状態管理
   - Native Messaging Host通信

2. **MCP Client**: `src/background/mcpClient.js`
   - MCPメッセージの送受信
   - Native Host通信管理
   - エラーハンドリング

3. **Content Scripts**: `src/content/content.js`
   - Webページとの統合
   - DOM操作
   - ページ情報抽出
   - サイドバーiframe管理

4. **Sidebar**: `src/sidebar/`
   - メインUI (sidebar.html, sidebar.js, sidebar.css)
   - チャット形式のAI操作インターフェース
   - MCP情報表示とデバッグパネル

5. **Options**: `src/options/`
   - 設定画面 (options.html, options.js, options.css)
   - AIプロバイダー設定管理

6. **Native Host**: `native-host/`
   - `host.js`: Chrome拡張機能とMCPサーバー間の橋渡し
   - `host-mock.js`, `host-simple.js`: テスト・開発用
   - Node.jsベースのローカルプロセス

### 開発環境

#### ファイル構造
```
chrome-ai-assist/
├── manifest.json          # 拡張機能設定
├── icons/                 # アイコンリソース
├── src/
│   ├── background/        # Service Worker
│   │   ├── background.js  # メインバックグラウンド処理
│   │   └── mcpClient.js   # MCP通信クライアント
│   ├── content/          # Content Scripts
│   │   ├── content.js    # ページ統合・サイドバー管理
│   │   └── content.css   # Content Scriptスタイル
│   ├── sidebar/          # メインUI（チャット）
│   │   ├── sidebar.html  # チャットUI
│   │   ├── sidebar.js    # チャット機能・MCP表示
│   │   └── sidebar.css   # チャットスタイル
│   └── options/          # 設定画面
│       ├── options.html  # 設定UI
│       ├── options.js    # 設定ロジック
│       └── options.css   # 設定スタイル
├── native-host/          # MCP Native Messaging Host
│   ├── host.js           # メインホスト（実際のMCP通信）
│   ├── host-mock.js      # モックホスト（テスト用）
│   ├── host-simple.js    # シンプルホスト（基本動作確認）
│   ├── switch-host.sh    # ホスト切り替えスクリプト
│   └── package.json      # Node.js依存関係
└── memory-bank/          # プロジェクト文書
```

#### 依存関係
- **Chrome APIs**: chrome.storage, chrome.tabs, chrome.scripting, chrome.runtime
- **Native Messaging**: Chrome Native Messaging API
- **AI APIs**: AWS Bedrock, OpenAI, Anthropic Claude
- **MCP**: Model Context Protocol (StdioClientTransport)
- **Node.js**: Native Host実行環境
- **Permissions**: activeTab, storage, scripting, nativeMessaging

### 技術的制約

#### Chrome拡張機能の制限
- **Manifest V3**: Service Worker必須、Background Scripts廃止
- **CSP (Content Security Policy)**: インラインスクリプト制限
- **権限モデル**: 最小権限の原則
- **Cross-Origin**: 外部API呼び出しの制限
- **Native Messaging**: ローカルプロセス実行の制限とセキュリティ

#### MCP統合の制約
- **Native Host**: ローカルプロセス実行権限が必要
- **Node.js依存**: MCPサーバー通信にNode.js環境が必要
- **ホスト登録**: Native Messaging Hostの手動設定が必要
- **セキュリティ**: ローカルプロセス間通信のセキュリティ確保

#### パフォーマンス要件
- **軽量**: メモリ使用量最小化
- **高速**: UI応答性2秒以内
- **効率性**: バッテリー消費最小化

### セキュリティ考慮事項
- **API キー管理**: 安全な認証情報保存
- **データプライバシー**: ユーザーデータの適切な処理
- **通信暗号化**: HTTPS必須
- **権限最小化**: 必要最小限のChrome権限
- **Native Host権限**: ローカルプロセス実行権限の適切な制限
- **MCP通信**: Native Messaging通信のセキュリティ確保
- **MCPトークン**: MCPサーバーAPIトークンの安全な管理

### 開発ツール
- **デバッグ**: Chrome DevTools, Extension Developer Mode
- **MCP開発**: 複数のホスト版（real/simple/mock）による段階的開発
- **Native Host管理**: switch-host.shによるホスト切り替え
- **テスト**: Manual Testing (Chrome拡張機能の特性上)
- **ビルド**: 現在は手動デプロイ
- **バージョン管理**: Git

### MCP開発環境
- **実開発**: `host.js` - 実際のMCPサーバーとの通信
- **テスト**: `host-mock.js` - モックレスポンスによるテスト
- **基本確認**: `host-simple.js` - シンプルな動作確認
- **切り替え**: `switch-host.sh` - ホスト版の簡単切り替え

### 今後の技術検討事項
- **TypeScript導入**: 型安全性の向上
- **ビルドツール**: webpack/Vite等の導入
- **テスト自動化**: Jest等のテストフレームワーク、MCP通信テスト
- **CI/CD**: 自動デプロイパイプライン
- **MCP拡張**: 新しいMCPサーバー対応（GitHub, Backlog等）
- **セキュリティ強化**: MCP通信の暗号化、認証機能
- **パフォーマンス最適化**: MCP通信の高速化
