# Tech Context: Chrome AI Assist

## 技術スタック

### Chrome拡張機能
- **Manifest Version**: V3 (最新仕様)
- **コア技術**: HTML, CSS, JavaScript (Vanilla JS)
- **アーキテクチャ**: Service Worker + Content Scripts + UI Components

### 構成要素
1. **Background (Service Worker)**: `src/background/background.js`
   - バックグラウンド処理
   - API通信管理
   - 状態管理

2. **Content Scripts**: `src/content/content.js`
   - Webページとの統合
   - DOM操作
   - ページ情報抽出

3. **Sidebar**: `src/sidebar/`
   - メインUI (sidebar.html, sidebar.js, sidebar.css)
   - チャット形式のAI操作インターフェース

4. **Options**: `src/options/`
   - 設定画面 (options.html, options.js, options.css)
   - ユーザーカスタマイズ

5. **Sidebar**: `src/sidebar/`
   - 詳細操作UI (sidebar.html, sidebar.js, sidebar.css)
   - 拡張されたAI機能

### 開発環境

#### ファイル構造
```
chrome-ai-assist/
├── manifest.json          # 拡張機能設定
├── icons/                 # アイコンリソース
├── src/
│   ├── background/        # Service Worker
│   ├── content/          # Content Scripts
│   ├── sidebar/          # メインUI（チャット）
│   └── options/          # 設定画面
└── memory-bank/          # プロジェクト文書
```

#### 依存関係
- **Chrome APIs**: chrome.storage, chrome.tabs, chrome.scripting
- **AI APIs**: 外部AI サービス（OpenAI, Claude等）との連携
- **Permissions**: activeTab, storage, scripting

### 技術的制約

#### Chrome拡張機能の制限
- **Manifest V3**: Service Worker必須、Background Scripts廃止
- **CSP (Content Security Policy)**: インラインスクリプト制限
- **権限モデル**: 最小権限の原則
- **Cross-Origin**: 外部API呼び出しの制限

#### パフォーマンス要件
- **軽量**: メモリ使用量最小化
- **高速**: UI応答性2秒以内
- **効率性**: バッテリー消費最小化

### セキュリティ考慮事項
- **API キー管理**: 安全な認証情報保存
- **データプライバシー**: ユーザーデータの適切な処理
- **通信暗号化**: HTTPS必須
- **権限最小化**: 必要最小限のChrome権限

### 開発ツール
- **デバッグ**: Chrome DevTools, Extension Developer Mode
- **テスト**: Manual Testing (Chrome拡張機能の特性上)
- **ビルド**: 現在は手動デプロイ
- **バージョン管理**: Git

### 今後の技術検討事項
- **TypeScript導入**: 型安全性の向上
- **ビルドツール**: webpack/Vite等の導入
- **テスト自動化**: Jest等のテストフレームワーク
- **CI/CD**: 自動デプロイパイプライン
