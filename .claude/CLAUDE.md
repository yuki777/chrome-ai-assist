# Chrome AI Assist - Architecture Guide for Claude

## プロジェクト概要
Chrome AI Assistは、Webページ内容をAIに読み込ませてチャット形式で対話できるChrome拡張機能です。OpenAIとAnthropic APIに対応し、Native Messaging経由でBacklog/DocBaseのMCP連携も備えています。

## アーキテクチャ構成

### 1. コンポーネント構造
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Service Worker │◄──►│ Content Scripts │◄──►│    Sidebar UI   │
│  (background.js)│    │  (content.js)   │    │  (sidebar.js)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Chrome Storage  │    │ DOM Manipulation│    │ Chat Interface  │
│   & AI APIs     │    │ & Page Extract  │    │  & User Input   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 2. データフローパターン
1. **ユーザーアクション** → 拡張機能アイコンクリック or フローティングボタンクリック
2. **Background Service Worker** → Content Scriptの注入確認と制御
3. **Content Script** → ページコンテンツの抽出とサイドバーの作成
4. **Sidebar UI** → チャットインターフェースの提供
5. **AI API呼び出し** → Background経由でのAPIリクエスト
6. **レスポンス処理** → UI更新とユーザーへの表示

## 重要な実装パターン

### 1. メッセージング
```javascript
// コンポーネント間通信はchrome.runtime.sendMessageを使用
chrome.runtime.sendMessage({ action: 'callAI', data: {...} }, response => {...});

// Content Script ↔ Sidebar間はpostMessageを使用
window.parent.postMessage({ type: 'ACTION_NAME', data: {...} }, '*');
```

### 2. API設定管理
- chrome.storage.localを使用して永続化
- apiProvider、apiKeys、selectedModelなどの設定を保存
- storage.onChangedリスナーで設定変更を即座に反映

### 3. セキュリティ考慮事項
- Content Security Policy (CSP)によるインラインスクリプト禁止
- 危険なページ（chrome://など）での機能無効化
- XSS防止のためのescapeHtml関数使用
- APIキーのローカル保存（外部送信なし）

### 4. ページコンテンツ抽出
```javascript
// 優先順位付きセレクターでメインコンテンツを抽出
const contentSelectors = [
  'article', 'main', '[role="main"]', '.content', 
  '.post-content', '.entry-content', '.article-content', 'body'
];
// 不要な要素（script, style, nav等）を除外
// 連続改行を単一改行に正規化
// 40,000文字制限で切り詰め
```

## ディレクトリ構造と責務

### /src/background/
- **background.js**: Service Worker本体
  - API呼び出しの処理（OpenAI、Anthropic）
  - Native Host接続管理（MCP連携）
  - メッセージルーティング
  - 拡張機能アイコンクリックハンドリング

### /src/content/
- **content.js**: ページとの統合
  - ページコンテンツの抽出
  - サイドバーiframeの作成と管理
  - フローティングボタンの設置
  - window.toggleSidebar関数の提供

### /src/sidebar/
- **sidebar.js**: チャットUI制御
  - メッセージ送受信
  - チャット履歴管理
  - DocBase/Backlog自動取得エンジン
  - デバッグパネル機能
  - IME（日本語入力）対応

### /native-host/
- **bin/setup.js**: ワンコマンドセットアップ（`npx chrome-ai-assist-native-host`）
- **src/host.js**: メッセージルーティング + ツールAllowlist
- **src/mcp-bridge.js**: MCP Client singleton管理、認証情報はChrome拡張から受信
- **src/native-protocol.js**: Chrome Native Messaging バイナリプロトコル
- **run-host.sh**: エントリポイント（Chromeが起動する）

### /src/options/
- **options.js**: 設定画面
  - APIプロバイダー切り替え
  - 認証情報の保存
  - モデル選択
  - カスタムインストラクション設定

## 開発時の注意点

### 1. Chrome拡張機能の制限
- Manifest V3準拠（Service Worker必須）
- activeTab権限でのタブアクセス制限
- CORS制限への対応

### 2. 日本語対応
- UI全体の日本語化
- IME入力時のEnterキー制御（compositionstart/end）
- AI応答の言語調整機能

### 3. パフォーマンス最適化
- Content Scriptの遅延ロード
- 並行処理での初期化（Promise.all使用）
- テキストエリアの動的リサイズ

### 4. エラーハンドリング
- API呼び出し失敗時の適切なエラーメッセージ
- chrome.runtime.lastErrorのチェック
- ユーザーフレンドリーなエラー表示

## API統合パターン

### OpenAI
- Responses API を使用
- Bearer Token認証

### Anthropic
- anthropic-dangerous-direct-browser-accessヘッダー必須
- システムプロンプトは別パラメータとして送信

## 今後の拡張ポイント
1. ストリーミング応答の実装
2. 会話履歴の永続化と管理
3. プロンプトテンプレート機能
4. ページ要約機能の追加
5. TypeScript導入による型安全性向上

## デバッグ方法
- Background: chrome://extensions → 詳細 → Service Worker
- Content Script: ページ上でF12 → Console
- Sidebar: サイドバー内で右クリック → 検証
- Storage: chrome.storage.local.get()でデバッグ

このガイドを参照することで、Chrome AI Assistの構造と実装パターンを理解し、効率的に開発を進めることができます。