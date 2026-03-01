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
│  │ コンテンツ│               │  - Backlog自動取得 │   │
│  │ 抽出     │               │  - 履歴・Star管理  │   │
│  │          │               └────────┬─────────┘   │
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
│  run-host.sh → node src/host.js                     │
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
| `manifest.json` | Manifest V3。`nativeMessaging` 権限を含む。`key` で拡張IDを固定 |
| `src/content/content.js` | ページコンテンツ抽出、DocBase/BacklogリンクID抽出、sidebar iframe作成、サイドバー幅管理 |
| `src/sidebar/sidebar.js` | チャットUI、DocBase/Backlog自動取得エンジン、履歴・Star管理 |
| `src/sidebar/sidebar.html` | チャットUI + 進捗バー + デバッグパネル |
| `src/background/background.js` | AI API呼び出し、Native Host接続管理、Allowlist検証 |
| `src/options/` | API設定画面（Bedrock/OpenAI/Anthropic） |

### 2.2 Native Host（ローカルプロセス）

| ファイル | 役割 |
|---------|------|
| `native-host/run-host.sh` | エントリポイント。`host.js` を起動 |
| `native-host/bin/setup.js` | ワンコマンドセットアップ（依存インストール + マニフェスト配置 + ping確認） |
| `native-host/src/host.js` | メッセージルーティング。`ping` / `call_tool` / `list_tools` を処理 |
| `native-host/src/mcp-bridge.js` | MCP Clientのsingleton管理。サーバごとに遅延接続。認証情報はChrome拡張から受信 |
| `native-host/src/native-protocol.js` | Chrome Native Messagingバイナリプロトコル実装 |
| `native-host/manifests/*.template` | Native Host manifest テンプレート（拡張IDはハードコード済み） |

### 2.3 MCP Server（サブプロセス）

Native Host から `npx` 経由で stdio で起動される。

| サーバ | 起動コマンド | 必要な認証情報（Chrome拡張設定画面で入力） |
|--------|-------------|------------------------------------------|
| Backlog | `npx -y backlog-mcp-server --dynamic-toolsets` | `BACKLOG_DOMAIN`, `BACKLOG_API_KEY` |
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
  │  = buildBaseSystemPrompt(pageData) + 【DocBase参考記事】+ 【Backlog課題】セクション
  │
  │  ※ 取得中にユーザーがメッセージ送信しても、
  │    その時点で取得済みの記事/課題が自動的に含まれる（ブロック不要）
```

### 3.3 Backlog課題 自動取得フロー

```
ページ読み込み
  ▼
content.js: extractBacklogLinks()
  │  ページURL + ページ内の全 <a> から Backlog課題キーを抽出
  │  → pageData.backlogIssueKeys = ["PROJ-123", ...]
  ▼
sidebar.js: handleMessage(INIT)
  │  initializeChat() + fetchBacklogIssues(issueKeys)
  ▼
fetchBacklogIssues()
  │  Worker Pool (並列3件)
  │  ├─ Worker 1: get_issue で課題取得 → 子課題を探索 → queueに追加
  │  ├─ Worker 2: get_issue で課題取得 → ...
  │  └─ Worker 3: get_issue で課題取得 → ...
  │
  │  各取得完了時:
  │    1. backlogIssues[] に追加
  │    2. rebuildSystemPrompt() でシステムプロンプト更新
  │    3. updateBacklogProgress() で進捗UI更新
  │
  │  子課題探索:
  │    - get_issues (parentIssueId フィルタ) で子課題一覧を取得
  │    - 未取得の子課題をキューに追加
  │
  │  停止条件:
  │    - 全課題取得完了
  │    - 合計文字数が 200,000文字を超過
  │    - 新しいページでfetchが再開（generation管理で旧fetch無効化）
```

## 4. セキュリティ

### ツール Allowlist（二重防御）

```
Layer 1: background.js (Chrome拡張内)
  MCP_ALLOW = {
    backlog: ['get_issue', 'get_issue_comments', 'get_issues'],
    docbase: ['get_post']
  }

Layer 2: host.js (Native Host内)
  ALLOW = {
    backlog: ['get_issue', 'get_issue_comments', 'get_issues'],
    docbase: ['get_post']
  }
```

sidebar.js からの任意のツール呼び出しは、両レイヤーで検証される。

### Native Host Manifest

`allowed_origins` で固定済みの拡張IDのみ接続を許可:
```json
{
  "allowed_origins": ["chrome-extension://kemfpceoehhnbhimmablbmmobleealma/"]
}
```

### APIキー管理

| キー | 保存場所 | 用途 |
|------|---------|------|
| AI API Keys (OpenAI/Anthropic) | `chrome.storage.local` | AI API呼び出し |
| Backlog / DocBase API Keys | `chrome.storage.local` → Native Hostへ送信 | MCP Server認証 |

認証情報はすべてChrome拡張の設定画面で管理。MCP認証情報はNative Host接続時に `configure` メッセージで送信される。

---

## 5. 導入手順

### 前提条件

- macOS
- Google Chrome
- Node.js 20以上

### Step 1: Chrome拡張のインストール

1. リポジトリをクローン:
   ```bash
   git clone https://github.com/yuki777/chrome-ai-assist.git
   ```
2. Chrome で `chrome://extensions/` を開く
3. 右上の「デベロッパーモード」をONにする
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. `chrome-ai-assist/` フォルダを選択

> 拡張機能IDは `manifest.json` の `key` フィールドで固定されているため、控える必要はありません。

### Step 2: AI API の設定

1. Chrome の拡張機能アイコンを右クリック →「オプション」
2. API Provider を選択（OpenAI / Anthropic）
3. API Keyを入力して保存

**ここまでで AIチャット機能が利用可能です。**

### Step 3: MCP連携のセットアップ（オプション）

Backlog / DocBase のコンテンツ自動取得を使う場合のみ必要です。

```bash
npx chrome-ai-assist-native-host
```

> npm公開前は `node native-host/bin/setup.js` で直接実行できます。

セットアップが完了したら:
1. Chrome の拡張機能アイコンを右クリック →「オプション」
2. Backlog / DocBase の認証情報を入力して保存
3. `chrome://extensions/` で拡張機能を再読み込み

### Step 4: 動作確認

1. 任意のWebページでサイドバーを開く
2. デバッグパネル（虫アイコン）を開く
3. 以下のテストを順番に実行:

| テスト | 期待結果 |
|--------|---------|
| **Ping テスト** | 「接続OK」と表示 |
| **Backlog: get_issue テスト** | issue情報がJSON表示 |
| **DocBase: get_post テスト** | 記事内容がJSON表示 |

4. DocBaseの記事ページを開くと、進捗バーが表示され記事が自動取得される
5. Backlogの課題ページを開くと、進捗バーが表示され課題と子課題が自動取得される

## 6. トラブルシューティング

### Native Host に接続できない

```
エラー: "native host disconnected" / "Host not found"
```

**確認ポイント:**
1. セットアップを実行したか: `npx chrome-ai-assist-native-host`
2. Manifest が正しい場所にあるか:
   ```bash
   cat ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.yuki777.chrome_ai_assist.mcp.json
   ```
3. `path` が `run-host.sh` の絶対パスになっているか
4. `run-host.sh` に実行権限があるか: `chmod +x run-host.sh`
5. 拡張を再読み込みしたか

### MCP Server に接続できない

```
エラー: "missing env: BACKLOG_DOMAIN (set in Chrome extension options)"
```

**確認ポイント:**
1. Chrome拡張の設定画面でBacklog / DocBase の認証情報が入力されているか
2. 認証情報を変更した場合、拡張を再読み込みしたか

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
│   │   ├── content.js            # ページ抽出 + DocBase/Backlogリンク検出 + サイドバー幅管理
│   │   └── content.css           # サイドバー幅CSS変数 + fixed要素補正
│   ├── sidebar/
│   │   ├── sidebar.html          # チャットUI + 進捗バー + デバッグパネル
│   │   ├── sidebar.js            # チャット + DocBase/Backlog取得エンジン + Star機能
│   │   └── sidebar.css
│   └── options/
│       ├── options.html          # API設定画面
│       ├── options.js
│       └── options.css
└── native-host/
    ├── package.json              # @modelcontextprotocol/sdk, bin + postinstall
    ├── run-host.sh               # エントリポイント
    ├── test-ping.js              # 手動テスト用
    ├── bin/
    │   └── setup.js              # ワンコマンドセットアップ
    ├── manifests/
    │   └── *.json.template       # Native Host manifest テンプレート（拡張IDハードコード済み）
    └── src/
        ├── host.js               # メッセージルーティング + Allowlist
        ├── mcp-bridge.js         # MCP Client singleton管理 + 認証情報受信
        └── native-protocol.js    # 4byte長プレフィックス プロトコル
```
