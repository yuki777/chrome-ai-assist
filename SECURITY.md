# セキュリティガイド

Chrome AI Assistの安全な運用のためのセキュリティガイドです。

## APIキーの管理

### Chrome拡張機能のAPIキー

Chrome拡張機能で使用するAPIキー（OpenAI、Anthropic、AWS）は以下の方法で安全に管理されています：

- **保存場所**: `chrome.storage.local`（ローカルストレージ）
- **暗号化**: Chromeによる自動暗号化
- **アクセス制限**: 拡張機能内でのみアクセス可能
- **外部送信**: APIキーは対応するサービスにのみ送信

### MCP APIトークンの管理

DocBase MCPサーバーなどで使用するAPIトークンは、以下のいずれかの方法で安全に管理してください：

#### 方法1: 環境変数（推奨）

```bash
# .bashrc, .zshrc, または .env ファイルに設定
export DOCBASE_DOMAIN="your-domain"
export DOCBASE_API_TOKEN="your-api-token"
```

host.jsで環境変数から読み込み：
```javascript
env: {
  DOCBASE_DOMAIN: process.env.DOCBASE_DOMAIN,
  DOCBASE_API_TOKEN: process.env.DOCBASE_API_TOKEN
}
```

#### 方法2: 設定ファイル（gitignoreされた）

```bash
# native-host/config.json を作成（.gitignoreに追加済み）
{
  "docbase": {
    "domain": "your-domain",
    "apiToken": "your-api-token"
  }
}
```

host.jsで設定ファイルから読み込み：
```javascript
const config = require('./config.json');
env: {
  DOCBASE_DOMAIN: config.docbase.domain,
  DOCBASE_API_TOKEN: config.docbase.apiToken
}
```

## ネットワークセキュリティ

### HTTPS通信

- すべてのAPI通信はHTTPS経由で実行
- 自己署名証明書は使用しない
- 証明書の検証を無効化しない

### CORS制限

- 拡張機能のmanifest.jsonで必要な権限のみを宣言
- 不要なドメインへのアクセス権限は付与しない

## コードセキュリティ

### プロンプトインジェクション対策

現在実装済みの対策：

1. **入力検証**: ユーザー入力の検証とサニタイゼーション
2. **コンテキスト分離**: システムプロンプトとユーザー入力の明確な分離
3. **出力フィルタリング**: AI応答の後処理とフィルタリング

### Content Security Policy (CSP)

manifest.jsonで設定済み：
```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self';"
}
```

## Native Messaging セキュリティ

### ホスト検証

- Native Messaging Hostは指定されたChrome拡張機能IDからのみアクセス可能
- 許可されていない拡張機能からの通信は拒否

### プロセス分離

- Native HostはChrome拡張機能とは別プロセスで実行
- 拡張機能の権限でNative Hostのファイルシステムアクセスは制限

## 開発時のセキュリティ

### 機密情報の取り扱い

1. **gitにコミットしない情報**:
   - APIキー・トークン
   - 個人情報
   - 内部ドメイン情報

2. **ログ出力の注意**:
   - APIキーをログに出力しない
   - 個人情報を含むデバッグ情報の制限

3. **テストデータ**:
   - 本番データを開発環境で使用しない
   - テスト用の専用アカウント・APIキーを使用

### コードレビュー

新機能追加時のチェックポイント：

- [ ] APIキーがハードコーディングされていないか
- [ ] 不要な権限が追加されていないか
- [ ] ユーザー入力の検証が適切か
- [ ] エラーメッセージに機密情報が含まれていないか

## インシデント対応

### APIキー漏洩時の対応

1. **即座に無効化**: 漏洩したAPIキーを即座に無効化
2. **新しいキーの発行**: 新しいAPIキーを発行
3. **設定の更新**: 拡張機能の設定を新しいキーで更新
4. **ログの確認**: アクセスログで不正使用がないか確認

### 脆弱性発見時の対応

1. **報告**: セキュリティ問題はGitHub Issuesではなく直接連絡
2. **修正**: 脆弱性の修正とパッチリリース
3. **通知**: ユーザーへの更新通知

## 継続的セキュリティ

### 定期的な見直し

- 依存関係の脆弱性チェック（npm audit）
- 使用していないAPIキーの無効化
- アクセス権限の最小化の確認

### 監視

- 異常なAPI使用量の監視
- エラーログの定期確認
- 新しい脅威情報の収集

---

セキュリティに関する質問や報告は、公開のIssueではなく直接ご連絡ください。