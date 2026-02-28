# Chrome AI Assist - アーキテクチャと導入手順

## 1. 全体構成

```
┌─────────────────────────────────────────────────────┐
│                    Chrome Browser                    │
│                                                     │
│  ┌──────────┐  postMessage  ┌──────────────────┐   │
│  │ Content  │◄────────────►│  Sidebar (iframe) │   │
│  │ Script   │               │  sidebar.js       │   │
│  │          │               │  - Chat UI        │   │
│  │ ページ   │               │  - DocBase自動取得 │   │
│  │ コンテンツ│               │  - 履歴・Star管理  │   │
│  │ 抽出     │               └────────┬─────────┘   │
│  └──────────┘                        │              │
│                      chrome.runtime.sendMessage     │
│                                      │              │
│  ┌───────────────────────────────────▼───────────┐  │
│  │          Background Service Worker             │  │
│  │          background.js                         │  │
│  │                                                │  │
│  │  ┌─────────────────┐  ┌─────────────────────┐ │  │
│  │  │ AI API呼び出し   │  │ Native Host Client  │ │  │
│  │  │ Bedrock/OpenAI/ │  │ MCP_ALLOW検証       │ │  │
│  │  │ Anthropic       │  │ requestId管理       │ │  │
│  │  └─────────────────┘  └──────────┬──────────┘ │  │
│  └───────────────────────────────────┬───────────┘  │
│                                      │              │
│                   chrome.runtime.connectNative()    │
└──────────────────────────────────────┬──────────────┘
                                       │
                    Native Messaging Protocol
                    (stdin/stdout, 4byte長プレフィックス + JSON)
                                       │
┌──────────────────────────────────────▼──────────────┐
│              Native Host (Node.js プロセス)          │
│                                                     │
│  run-host.sh (.env読み込み → node src/host.js)      │
│                                                     │
│  ┌────────────────┐                                 │
│  │ host.js        │  ALLOW検証 → mcp-bridge.js     │
│  │ メッセージ      │                                 │
│  │ ルーティング    │                                 │
│  └───────┬────────┘                                 │
│          │                                          │
│  ┌───────▼────────────────────────────────────────┐ │
│  │ mcp-bridge.js                                  │ │
│  │ MCP Client管理（singleton接続、遅延初期化）      │ │
│  │                                                │ │
│  │  ┌──────────────────┐  ┌────────────────────┐  │ │
│  │  │ StdioTransport   │  │ StdioTransport     │  │ │
│  │  │ → backlog-mcp    │  │ → docbase-mcp      │  │ │
│  │  │   -server        │  │   -server          │  │ │
│  │  └──────────────────┘  └────────────────────┘  │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## 2. コンポーネント詳細

### 2.1 Chrome拡張（フロントエンド）

| ファイル | 役割 |
|---------|------|
| `manifest.json` | Manifest V3。`nativeMessaging` 権限を含む |
| `src/content/content.js` | ページコンテンツ抽出、DocBaseリンクID抽出、sidebar iframe作成 |
| `src/sidebar/sidebar.js` | チャットUI、DocBase記事自動取得エンジン、履歴・Star管理 |
| `src/sidebar/sidebar.html` | チャットUI + 進捗バー + デバッグパネル |
| `src/background/background.js` | AI API呼び出し、Native Host接続管理、Allowlist検証 |
| `src/options/` | API設定画面（Bedrock/OpenAI/Anthropic） |

### 2.2 Native Host（ローカルプロセス）

| ファイル | 役割 |
|---------|------|
| `native-host/run-host.sh` | エントリポイント。`.env` 読み込み後 `host.js` を起動 |
| `native-host/src/host.js` | メッセージルーティング。`ping` / `call_tool` / `list_tools` を処理 |
| `native-host/src/mcp-bridge.js` | MCP Clientのsingleton管理。サーバごとに遅延接続 |
| `native-host/src/native-protocol.js` | Chrome Native Messagingバイナリプロトコル実装 |
| `native-host/manifests/*.template` | Native Host manifest テンプレート |
| `native-host/scripts/install-host-manifest-macos.sh` | macOS用セットアップスクリプト |

### 2.3 MCP Server（サブプロセス）

Native Host から `npx` 経由で stdio で起動される。

| サーバ | 起動コマンド | 必要な環境変数 |
|--------|-------------|---------------|
| Backlog | `npx -y github:shueisha-arts-and-digital/backlog-mcp-server` | `BACKLOG_DOMAIN`, `BACKLOG_API_KEY` |
| DocBase | `npx -y github:shueisha-arts-and-digital/docbase-mcp-server` | `DOCBASE_DOMAIN`, `DOCBASE_API_TOKEN` |

## 3. データフロー

### 3.1 MCP ツール呼び出し

```
sidebar.js
  │  chrome.runtime.sendMessage({
  │    action: 'callMcpTool',
  │    payload: { server: 'docbase', tool: 'get_post', arguments: { id: 123 } }
  │  })
  ▼
background.js
  │  1. MCP_ALLOW でツール許可を検証
  │  2. requestId (UUID) を生成
  │  3. callNativeHost() でメッセージ送信
  │  4. 30秒タイムアウト付き Promise で応答待ち
  ▼
Native Messaging Protocol (stdin)
  │  [4byte長][JSON: { id, type:"call_tool", server, tool, arguments }]
  ▼
host.js
  │  1. ALLOW でツール許可を再検証（二重防御）
  │  2. mcp-bridge.js の callTool() を呼び出し
  ▼
mcp-bridge.js
  │  1. getClient() で singleton MCP Client を取得（初回は接続）
  │  2. client.callTool({ name, arguments }) を実行
  ▼
MCP Server (subprocess)
  │  ツール実行 → 結果返却
  ▼
host.js
  │  writeMessage(stdout, { id, ok: true, result })
  ▼
Native Messaging Protocol (stdout)
  │  [4byte長][JSON応答]
  ▼
background.js
  │  requestId で Promise を解決 → sendResponse()
  ▼
sidebar.js
  │  応答を受信・処理
```

### 3.2 DocBase記事 自動取得フロー

```
ページ読み込み
  ▼
content.js: extractDocBaseLinks()
  │  ページURL + ページ内の全 <a> から DocBase記事IDを抽出
  │  → pageData.docbasePostIds = ["4059197", ...]
  ▼
sidebar.js: handleMessage(INIT)
  │  initializeChat() + fetchDocBaseArticles(postIds)
  ▼
fetchDocBaseArticles()
  │  Worker Pool (並列3件)
  │  ├─ Worker 1: queue[0] を取得 → 本文からEmbed ID発見 → queueに追加
  │  ├─ Worker 2: queue[1] を取得 → ...
  │  └─ Worker 3: queue[2] を取得 → ...
  │
  │  各取得完了時:
  │    1. docbaseArticles[] に追加
  │    2. rebuildSystemPrompt() でシステムプロンプト更新
  │    3. updateDocBaseProgress() で進捗UI更新
  │
  │  Embed記法の検出パターン:
  │    - #{12345}
  │    - #{https://xxx.docbase.io/posts/12345}
  │    - https://xxx.docbase.io/posts/12345
  │    - [text](/posts/12345)
  │    - /posts/12345
  │
  │  停止条件:
  │    - 全記事取得完了
  │    - 合計文字数が 200,000文字を超過
  │    - 新しいページでfetchが再開（generation管理で旧fetch無効化）
  ▼
rebuildSystemPrompt()
  │  chatHistory[0].content を更新
  │  = buildBaseSystemPrompt(pageData) + 【DocBase参考記事】セクション
  │
  │  ※ 取得中にユーザーがメッセージ送信しても、
  │    その時点で取得済みの記事が自動的に含まれる（ブロック不要）
```

## 4. セキュリティ

### ツール Allowlist（二重防御）

```
Layer 1: background.js (Chrome拡張内)
  MCP_ALLOW = {
    backlog: ['get_issue', 'get_issue_comments'],
    docbase: ['get_post']
  }

Layer 2: host.js (Native Host内)
  ALLOW = {
    backlog: ['get_issue', 'get_issue_comments'],
    docbase: ['get_post']
  }
```

sidebar.js からの任意のツール呼び出しは、両レイヤーで検証される。

### Native Host Manifest

`allowed_origins` で特定の拡張IDのみ接続を許可:
```json
{
  "allowed_origins": ["chrome-extension://<EXTENSION_ID>/"]
}
```

### APIキー管理

| キー | 保存場所 | 用途 |
|------|---------|------|
| AI API Keys (Bedrock/OpenAI/Anthropic) | `chrome.storage.local` | AI API呼び出し |
| Backlog / DocBase API Keys | Native Host側 `.env` ファイル | MCP Server認証 |

---

## 5. 導入手順

### 前提条件

- macOS
- Google Chrome
- Node.js 20以上
- `npx` が使える状態
- Backlog / DocBase の API キーを取得済み

### Step 1: リポジトリのクローン

```bash
git clone https://github.com/yuki777/chrome-ai-assist.git
cd chrome-ai-assist
```

### Step 2: Chrome拡張のインストール

1. Chrome で `chrome://extensions/` を開く
2. 右上の「デベロッパーモード」をONにする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `chrome-ai-assist/` フォルダを選択
5. 拡張機能が追加されたら、表示される**拡張ID**を控える

### Step 3: Native Host のセットアップ

```bash
# 依存パッケージのインストール
cd native-host
npm install
```

### Step 4: 環境変数の設定

`native-host/.env` ファイルを作成:

```bash
cat > .env << 'EOF'
BACKLOG_DOMAIN=your-domain.backlog.jp
BACKLOG_API_KEY=your-backlog-api-key
DOCBASE_DOMAIN=your-team
DOCBASE_API_TOKEN=your-docbase-api-token
EOF
```

> **注意**: `.env` ファイルは `.gitignore` に含めること。
> Chrome はシェルの環境変数を Native Host に引き継がないため、
> `run-host.sh` が `.env` を `source` して読み込む。

### Step 5: Native Host Manifest のインストール

```bash
# native-host/ ディレクトリ内で実行
./scripts/install-host-manifest-macos.sh \
  --extension-id <Step 2で控えた拡張ID>
```

成功すると以下が出力される:
```
Installed: ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.yuki777.chrome_ai_assist.mcp.json
Host path: /path/to/native-host/run-host.sh
Extension ID: xxxxxxxxxxxx
```

### Step 6: AI API の設定

1. Chrome の拡張機能アイコンを右クリック →「オプション」
2. API Provider を選択（Bedrock / OpenAI / Anthropic）
3. 認証情報を入力して保存

### Step 7: Chrome拡張の再読み込み

`chrome://extensions/` で Chrome AI Assist の「更新」ボタンをクリック。

### Step 8: 動作確認

1. 任意のWebページでサイドバーを開く
2. デバッグパネル（虫アイコン）を開く
3. 以下のテストを順番に実行:

| テスト | 期待結果 |
|--------|---------|
| **Ping テスト** | 「接続OK」と表示 |
| **Backlog: get_issue テスト** | issue情報がJSON表示 |
| **DocBase: get_post テスト** | 記事内容がJSON表示 |

4. DocBaseの記事ページを開くと、進捗バーが表示され記事が自動取得される

## 6. トラブルシューティング

### Native Host に接続できない

```
エラー: "native host disconnected" / "Host not found"
```

**確認ポイント:**
1. Manifest が正しい場所にあるか:
   ```bash
   cat ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.yuki777.chrome_ai_assist.mcp.json
   ```
2. `path` が `run-host.sh` の絶対パスになっているか
3. `allowed_origins` の拡張IDが一致しているか
4. `run-host.sh` に実行権限があるか: `chmod +x run-host.sh`
5. 拡張を再読み込みしたか

### MCP Server に接続できない

```
エラー: "missing env: BACKLOG_DOMAIN"
```

**確認ポイント:**
1. `native-host/.env` に必要な環境変数が設定されているか
2. `.env` のフォーマットが正しいか（`KEY=VALUE` 形式、引用符不要）

### 手動テスト

Native Host を直接テストする:
```bash
cd native-host
node test-ping.js
```

## 7. ディレクトリ構成

```
chrome-ai-assist/
├── manifest.json
├── README.md
├── docs/
│   ├── architecture-and-setup.md        ← このファイル
│   └── native-messaging-stdio-mcp-implementation.md
├── icons/
│   ├── icon16.png, icon48.png, icon128.png
├── src/
│   ├── background/
│   │   └── background.js         # Service Worker + Native Host Client
│   ├── content/
│   │   ├── content.js            # ページ抽出 + DocBaseリンク検出
│   │   └── content.css
│   ├── sidebar/
│   │   ├── sidebar.html          # チャットUI + 進捗バー + デバッグパネル
│   │   ├── sidebar.js            # チャット + DocBase取得エンジン + Star機能
│   │   └── sidebar.css
│   └── options/
│       ├── options.html          # API設定画面
│       ├── options.js
│       └── options.css
└── native-host/
    ├── package.json              # @modelcontextprotocol/sdk
    ├── run-host.sh               # エントリポイント（.env読み込み）
    ├── test-ping.js              # 手動テスト用
    ├── manifests/
    │   └── *.json.template       # Native Host manifest テンプレート
    ├── scripts/
    │   └── install-host-manifest-macos.sh
    └── src/
        ├── host.js               # メッセージルーティング + Allowlist
        ├── mcp-bridge.js         # MCP Client singleton管理
        └── native-protocol.js    # 4byte長プレフィックス プロトコル
```
