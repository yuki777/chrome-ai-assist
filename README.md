# Chrome AI Assist

現在見ているWebページの内容をAIに読み込ませて、チャット形式で会話できるChrome拡張機能です。

## 機能

- 🔍 **ページ内容の自動抽出**: 現在のWebページの内容を自動的に読み込み
- 💬 **AI チャット**: ページ内容について質問や指示が可能
- 🎨 **サイドバーUI**: 画面右側1/3にチャットインターフェースを表示
- ⚙️ **複数API対応**: AWS Bedrock、OpenAI、Anthropic APIに対応
- 🌐 **日本語対応**: UIとAI応答の完全日本語対応

## 対応API

### AWS Bedrock
- Claude 3.5 Sonnet
- Claude 3 Haiku
- その他Anthropicモデル

### OpenAI
- GPT-4
- GPT-4 Turbo
- GPT-3.5 Turbo

### Anthropic
- Claude 3.5 Sonnet
- Claude 3 Haiku
- 最新のClaudeモデル

## インストール

### 開発者モードでのインストール

1. このリポジトリをクローンまたはダウンロード
```bash
git clone https://github.com/your-username/chrome-ai-assist.git
cd chrome-ai-assist
```

2. Chromeの拡張機能ページを開く
   - `chrome://extensions/` にアクセス
   - 右上の「デベロッパーモード」を有効化

3. 拡張機能を読み込み
   - 「パッケージ化されていない拡張機能を読み込む」をクリック
   - プロジェクトフォルダを選択

## 使用方法

### 1. API設定

1. 拡張機能アイコンをクリック
2. 「設定」ボタンをクリック
3. 使用したいAPI Providerを選択
4. 必要な認証情報を入力：

#### AWS Bedrock の場合
- AWS Access Key
- AWS Secret Key
- AWS Region
- （オプション）Session Token

#### OpenAI の場合
- OpenAI API Key

#### Anthropic の場合
- Anthropic API Key

### 2. AI Assistの起動

1. Webページを開く
2. 以下のいずれかの方法でAI Assistを起動：
   - 画面右側のフローティングボタンをクリック
   - 拡張機能アイコンから「AI Assistを開く」をクリック
   - キーボードショートカット（Alt+A）

### 3. チャット

1. サイドバーが開くと、ページ内容が自動読み込みされます
2. 「{URL} {タイトル} を読み込みました。質問や指示があればどうぞ！」というメッセージが表示
3. テキストボックスに質問や指示を入力
4. AIがページ内容を理解した上で応答

## プロジェクト構造

```
chrome-ai-assist/
├── manifest.json                # Manifest V3設定
├── src/
│   ├── background/
│   │   └── background.js        # Service Worker
│   ├── content/
│   │   ├── content.js          # Content Script
│   │   └── content.css         # Content Scriptスタイル
│   ├── sidebar/
│   │   ├── sidebar.html        # チャットUI
│   │   ├── sidebar.js          # チャット機能
│   │   └── sidebar.css         # チャットスタイル
│   ├── popup/
│   │   ├── popup.html          # ポップアップUI
│   │   ├── popup.js            # ポップアップ機能
│   │   └── popup.css           # ポップアップスタイル
│   └── options/
│       ├── options.html        # 設定画面
│       ├── options.js          # 設定ロジック
│       └── options.css         # 設定スタイル
├── icons/                      # アイコンファイル
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## 開発

### 必要な環境
- Chrome または Chromium ベースのブラウザ
- 対応APIのアカウントとAPIキー

### デバッグ

1. **Background Script**: Chrome DevTools > Extensions > Chrome AI Assist > Background page
2. **Content Script**: 任意のページでF12 > Console
3. **Popup**: 拡張機能アイコンを右クリック > 「ポップアップを検証」
4. **Options**: 設定ページでF12
5. **Sidebar**: サイドバー内で右クリック > 「検証」

### 開発時の注意点

- ファイルを変更した場合は拡張機能の再読み込みが必要
- Content Scriptの変更はページのリロードも必要
- API呼び出し時はCORS制限に注意

## セキュリティ

- APIキーはローカルストレージ（chrome.storage.local）に保存
- APIキーは外部に送信されず、拡張機能内でのみ使用
- HTTPS接続でのみAPI通信を実行

## ライセンス

MIT License

## 貢献

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. Pull Requestを作成

## 今後の予定

- [ ] ストリーミング応答の対応
- [ ] 会話履歴の保存・管理
- [ ] カスタムプロンプトテンプレート
- [ ] ページの要約機能
- [ ] 多言語対応の拡張
- [ ] AWS Bedrock認証の完全実装
- [ ] OpenAI Function Calling対応

## トラブルシューティング

### よくある問題

**Q: サイドバーが表示されない**
A: ページをリロードしてからもう一度試してください。chrome://や拡張機能ページでは動作しません。

**Q: API設定が保存されない**
A: ブラウザの拡張機能権限でストレージアクセスが許可されているか確認してください。

**Q: AI応答が返ってこない**
A: APIキーが正しく設定されているか、ネットワーク接続を確認してください。

**Q: AWS Bedrockでエラーが発生**
A: 現在AWS Bedrock APIの認証実装が未完了です。OpenAIまたはAnthropicをお使いください。

## サポート

問題や質問がある場合は、GitHubのIssuesページで報告してください。

---

© 2024 Chrome AI Assist. All rights reserved.
