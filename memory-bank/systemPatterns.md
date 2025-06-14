# System Patterns: Chrome AI Assist

## アーキテクチャパターン

### Chrome拡張機能アーキテクチャ
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
```

### メッセージング・パターン
- **Runtime Messages**: `chrome.runtime.sendMessage()` - コンポーネント間通信
- **Tab Communication**: Content Scripts ↔ Background ↔ UI
- **Storage Events**: `chrome.storage.onChanged` - 設定変更の同期

### 状態管理パターン
- **Chrome Storage**: 永続的な設定・状態保存
- **Session State**: Service Worker内の一時状態
- **UI State**: 各UIコンポーネントのローカル状態

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

### 2. 動的UI有効化
- API設定状況に基づくボタンの有効/無効切り替え
- ページサポート状況の動的チェック
- リアルタイムの設定反映

### 3. セキュリティパターン
- **Content Security Policy**: インラインスクリプト禁止
- **権限最小化**: 必要最小限のChrome権限
- **XSS防止**: `escapeHtml()`関数の使用

## コンポーネント関係図

### データフロー
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
AI API Call
    ↓
Response Processing
    ↓
UI Update (Sidebar)
```

### 状態同期パターン
```javascript
// 設定変更の即座反映
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.apiProvider || changes.apiKeys)) {
    checkApiStatus(); // UI即座更新
  }
});
```

## 実装パターン

### 1. エラーハンドリング
- `try-catch`による例外処理
- `chrome.runtime.lastError`チェック
- ユーザーフレンドリーなエラー表示

### 2. 非同期処理
- `async/await`の一貫した使用
- `Promise.all()`による並行処理最適化
- 適切なエラーバブリング

### 3. UI/UX パターン
- **ローディング状態**: ボタンの動的無効化
- **キーボードショートカット**: Alt+A, Alt+S
- **レスポンシブフィードバック**: 即座の状態反映

### 4. パフォーマンスパターン
- **遅延ロード**: 必要時のみContent Script実行
- **メモリ効率**: window.close()によるポップアップ自動クローズ
- **バッチ処理**: 複数初期化処理の並行実行

## セキュリティパターン

### 1. データ保護
```javascript
// 安全なHTML escaping
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

### 2. 権限管理
- `activeTab`: 現在のタブのみアクセス
- `storage`: 設定データの永続化
- `scripting`: 必要時のみスクリプト注入

### 3. ページ制限
```javascript
// 危険なページでの機能無効化
if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:') {
  // 機能無効化
}
```

## 今後の拡張パターン
- **プラグインアーキテクチャ**: 新AIプロバイダーの簡単追加
- **設定階層化**: ユーザー・プロジェクト・グローバル設定
- **キャッシュ戦略**: API応答とページコンテンツのキャッシュ
- **バックグラウンド処理**: 大きなタスクの非同期実行
