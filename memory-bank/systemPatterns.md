# System Patterns: Chrome AI Assist

## アーキテクチャパターン

### Chrome拡張機能アーキテクチャ（MCP統合版）
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Service       │    │   Content       │    │   UI Components │
│   Worker        │◄──►│   Scripts       │◄──►│   (Sidebar)     │
│   (Background)  │    │   (Web Page)    │    │   (Extension)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Chrome        │    │   DOM           │    │   User          │
│   Storage API   │    │   Manipulation  │    │   Interface     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                                             
         ▼                                             
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Native        │    │   MCP           │    │   External      │
│   Messaging     │◄──►│   Host          │◄──►│   MCP Servers   │
│   Host          │    │   (Node.js)     │    │   (DocBase等)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### MCP統合アーキテクチャ詳細
```
Chrome Extension
┌─────────────────────────────────────────────────────────────┐
│ Background Service Worker                                   │
│ ┌─────────────────┐  ┌─────────────────┐                  │
│ │ background.js   │  │ mcpClient.js    │                  │
│ │ - AI API calls  │  │ - MCP messaging │                  │
│ │ - State mgmt    │  │ - Error handling│                  │
│ └─────────────────┘  └─────────────────┘                  │
│                               │                            │
│ Content Scripts              │  Sidebar UI                │
│ ┌─────────────────┐          │  ┌─────────────────┐        │
│ │ content.js      │          │  │ sidebar.js      │        │
│ │ - Page analysis │          │  │ - Chat UI       │        │
│ │ - Sidebar mgmt  │          │  │ - MCP display   │        │
│ └─────────────────┘          │  └─────────────────┘        │
└──────────────────────────────┼─────────────────────────────┘
                               │ Native Messaging API
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Native Host (Node.js Process)                              │
│ ┌─────────────────┐  ┌─────────────────┐                  │
│ │ host.js         │  │ StdioClient     │                  │
│ │ - Message relay │  │ Transport       │                  │
│ │ - MCP client    │  │ - MCP protocol  │                  │
│ └─────────────────┘  └─────────────────┘                  │
└──────────────────────────────┼─────────────────────────────┘
                               │ stdio/process communication
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ External MCP Servers                                        │
│ ┌─────────────────┐  ┌─────────────────┐                  │
│ │ DocBase Server  │  │ GitHub Server   │ (計画中)          │
│ │ - Post details  │  │ - Repo info     │                  │
│ │ - Search posts  │  │ - Issue mgmt    │                  │
│ └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### メッセージング・パターン
- **Runtime Messages**: `chrome.runtime.sendMessage()` - コンポーネント間通信
- **Tab Communication**: Content Scripts ↔ Background ↔ UI
- **Native Messaging**: `chrome.runtime.connectNative()` - Native Host通信
- **MCP Protocol**: MCP Request/Response pattern - MCPサーバー通信
- **Storage Events**: `chrome.storage.onChanged` - 設定変更の同期
- **PostMessage**: `window.postMessage()` - Sidebar iframe通信

### 状態管理パターン
- **Chrome Storage**: 永続的な設定・状態保存
- **Session State**: Service Worker内の一時状態
- **UI State**: 各UIコンポーネントのローカル状態
- **MCP State**: Native Host接続状況、MCPサーバー状態
- **Chat History**: 1ヶ月間のメッセージ履歴保持

## 重要な設計判断

### 1. マルチプロバイダー対応
```javascript
// 統一されたAIプロバイダーインターフェース
const providers = {
  bedrock: { awsAccessKey, awsSecretKey, awsRegion },
  openai: { openaiApiKey },
  anthropic: { anthropicApiKey }
};
```

### 2. MCP統合パターン
```javascript
// Native Host通信管理
class MCPClient {
  constructor() {
    this.port = null;
    this.messageId = 0;
    this.pendingRequests = new Map();
  }
  
  async connect() {
    this.port = chrome.runtime.connectNative('com.chrome_ai_assist.mcp_bridge');
    this.port.onMessage.addListener(this.handleMessage.bind(this));
    this.port.onDisconnect.addListener(this.handleDisconnect.bind(this));
  }
}
```

### 3. DocBase自動認識パターン
```javascript
// ページURL解析による自動MCP処理
const extractDocBasePostId = (url) => {
  const match = url.match(/\/posts\/(\d+)/);
  return match ? parseInt(match[1]) : null;
};

if (url.includes('docbase.io') && postId) {
  // MCP処理を自動トリガー
  await triggerMCPProcessing(postId);
}
```

### 4. 動的UI有効化
- API設定状況に基づくボタンの有効/無効切り替え
- ページサポート状況の動的チェック
- MCP機能の自動有効化（対応ページ検出時）
- リアルタイムの設定反映

### 5. セキュリティパターン
- **Content Security Policy**: インラインスクリプト禁止
- **権限最小化**: 必要最小限のChrome権限
- **XSS防止**: `escapeHtml()`関数の使用
- **Native Host権限**: ローカルプロセス実行の適切な制限
- **MCP通信セキュリティ**: Native Messaging APIによる安全な通信

## コンポーネント関係図

### 基本データフロー
```
User Action (Extension Icon Click)
    ↓
Background Service Worker
    ↓
Content Script Injection
    ↓
DOM Manipulation & Page Analysis
    ↓
Sidebar Creation & Initialization
    ↓
AI API Call / MCP Processing
    ↓
Response Processing
    ↓
UI Update (Sidebar)
```

### MCP統合データフロー
```
DocBase Page Detection
    ↓
Content Script Analysis
    ↓
Background Service Worker
    ↓
MCP Client (mcpClient.js)
    ↓
Native Messaging API
    ↓
Native Host (host.js)
    ↓
MCP Server Communication
    ↓
DocBase API Call
    ↓
Response Chain (逆順)
    ↓
Sidebar MCP Info Display
```

### 状態同期パターン
```javascript
// 設定変更の即座反映
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.apiProvider || changes.apiKeys)) {
    checkApiStatus(); // UI即座更新
  }
});

// MCP状態同期
const mcpStatusManager = {
  updateStatus: (status) => {
    // MCP接続状況をUIに反映
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'MCP_STATUS_UPDATE',
        status: status
      });
    });
  }
};
```

## 実装パターン

### 1. エラーハンドリング
- `try-catch`による例外処理
- `chrome.runtime.lastError`チェック
- MCP通信エラーの詳細ハンドリング
- ユーザーフレンドリーなエラー表示

### 2. 非同期処理
- `async/await`の一貫した使用
- `Promise.all()`による並行処理最適化
- MCP通信の非同期処理管理
- 適切なエラーバブリング

### 3. UI/UX パターン
- **ローディング状態**: ボタンの動的無効化
- **キーボードショートカット**: Alt+A, Alt+S
- **レスポンシブフィードバック**: 即座の状態反映
- **MCP情報表示**: デバッグパネルでの詳細情報
- **自動ページ認識**: 対応ページでのMCP機能自動有効化

### 4. パフォーマンスパターン
- **遅延ロード**: 必要時のみContent Script実行
- **メモリ効率**: 適切なリソース管理
- **バッチ処理**: 複数初期化処理の並行実行
- **MCP接続プーリング**: Native Host接続の効率的な管理
- **キャッシュ戦略**: MCP応答のローカルキャッシュ

## セキュリティパターン

### 1. データ保護
```javascript
// 安全なHTML escaping
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// MCP通信データの検証
function validateMCPResponse(response) {
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid MCP response format');
  }
  // レスポンス形式の検証
  return response;
}
```

### 2. 権限管理
- `activeTab`: 現在のタブのみアクセス
- `storage`: 設定データの永続化
- `scripting`: 必要時のみスクリプト注入
- `nativeMessaging`: Native Host通信（最小権限）

### 3. ページ制限
```javascript
// 危険なページでの機能無効化
if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:') {
  // 機能無効化
}

// MCP機能の適切なページ制限
function isMCPSupportedPage(url) {
  const supportedDomains = ['docbase.io', 'github.com', 'backlog.com'];
  return supportedDomains.some(domain => url.includes(domain));
}
```

## 今後の拡張パターン
- **プラグインアーキテクチャ**: 新AIプロバイダーの簡単追加
- **MCP Server拡張**: 新しいMCPサーバーの標準化された追加プロセス
- **設定階層化**: ユーザー・プロジェクト・グローバル設定
- **キャッシュ戦略**: API応答、ページコンテンツ、MCP応答のキャッシュ
- **バックグラウンド処理**: 大きなタスクの非同期実行
- **MCP通信最適化**: 接続プーリング、応答キャッシュ、エラー回復
- **セキュリティ強化**: MCP通信の暗号化、認証トークン管理
