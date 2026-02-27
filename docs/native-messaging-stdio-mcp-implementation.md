# Native Messaging + ローカル stdio MCP 中継 実装指示書

## 1. 目的
`chrome-ai-assist` から `Native Messaging` を使ってローカルプロセスへ接続し、ローカル起動した MCP Server（Backlog / DocBase, stdio）を中継して呼び出せる状態を作る。

## 2. スコープ
この指示書で実装する範囲は PoC です。

- Chrome拡張 Service Worker から Native Host へ接続できる
- Native Host から `backlog-mcp-server` と `docbase-mcp-server` を stdio で呼び出せる
- ツール1件以上の実行結果を拡張へ返せる

この指示書で実装しない範囲です。

- Streamable HTTP 化
- 本番配布用インストーラーの作り込み
- UIの大幅改修

## 3. 前提
- OS: macOS
- Chrome拡張は unpacked load で検証
- Node.js 20+
- `npx` で下記MCP Serverを起動できること
  - `https://github.com/shueisha-arts-and-digital/backlog-mcp-server`
  - `https://github.com/shueisha-arts-and-digital/docbase-mcp-server`

## 4. 実装アーキテクチャ
構成は以下。

1. `sidebar.js` -> `background.js` に「MCP実行要求」を送る  
2. `background.js` -> `chrome.runtime.connectNative()` で Native Host に送る  
3. Native Host -> MCP Client（stdio）で Backlog/DocBase MCP Server を呼ぶ  
4. 実行結果を Native Host -> `background.js` -> `sidebar.js` へ返す  

補足:
- Content Script からは `connectNative` を呼べないため、Service Workerで実行する
- Native Host の `stdout` は Native Messaging プロトコル専用。ログは `stderr` へ出す

## 5. 変更対象ファイル
### 5.1 追加
- `native-host/package.json`
- `native-host/src/host.js`
- `native-host/src/mcp-bridge.js`
- `native-host/src/native-protocol.js`
- `native-host/scripts/install-host-manifest-macos.sh`
- `native-host/manifests/com.yuki777.chrome_ai_assist.mcp.json.template`

### 5.2 既存変更
- `manifest.json`
- `src/background/background.js`
- `src/sidebar/sidebar.js`（最小UI、またはデバッグ導線のみ）

## 6. 拡張側 実装手順
## 6.1 manifest 更新
`manifest.json` の `permissions` に `nativeMessaging` を追加。

例:
```json
"permissions": [
  "storage",
  "activeTab",
  "scripting",
  "nativeMessaging"
]
```

## 6.2 background.js に Native Host クライアント層を追加
実装要件:

- host名定数を定義: `com.yuki777.chrome_ai_assist.mcp`
- ポート管理:
  - 初回要求時に `chrome.runtime.connectNative(hostName)` を作成
  - `onDisconnect` で再接続可能な状態に戻す
- 要求応答マップ:
  - `requestId` ごとに Promise を保持
  - タイムアウト（例: 30秒）で reject
- メッセージハンドリング:
  - `request.action === "callMcpTool"` を受け付け
  - Native Hostへ `{ id, type:"call_tool", server, tool, arguments }` を送る
  - 返却を `sendResponse` へ返す

推奨I/F:
```js
{
  action: "callMcpTool",
  payload: {
    server: "backlog" | "docbase",
    tool: "get_issue",
    arguments: { issueIdOrKey: "PROJ-123" }
  }
}
```

## 6.3 sidebar.js に検証導線を追加
PoCでは最小でよい。

- 方式A: デバッグボタン押下で固定ツールを1回呼ぶ
- 方式B: `/mcp backlog get_issue PROJ-123` のコマンド入力を解析して呼ぶ

まずは方式Aを推奨。

## 7. Native Host 実装手順
## 7.1 Native Messaging 入出力実装
`native-host/src/native-protocol.js` で以下を実装。

- `readMessage(stdin)`:
  - 先頭4byte（ネイティブエンディアン）で長さ取得
  - JSON本文を読み込んで parse
- `writeMessage(stdout, obj)`:
  - JSON文字列をUTF-8化
  - 4byte長 + 本文を書き込み

注意:
- `stdout` に `console.log` しない
- ログは必ず `stderr` に出力

## 7.2 MCPブリッジ層
`native-host/src/mcp-bridge.js` で server別に MCP client を管理。

推奨:
- `@modelcontextprotocol/sdk` の client + stdio transport を利用
- serverごとに singleton 接続
- 初回呼び出し時に起動、以降は再利用

起動コマンド例:
- backlog
  - command: `npx`
  - args: `["-y", "https://github.com/shueisha-arts-and-digital/backlog-mcp-server"]`
  - env: `BACKLOG_DOMAIN`, `BACKLOG_API_KEY`
- docbase
  - command: `npx`
  - args: `["-y", "https://github.com/shueisha-arts-and-digital/docbase-mcp-server"]`
  - env: `DOCBASE_DOMAIN`, `DOCBASE_API_TOKEN`

## 7.3 Native Host 本体
`native-host/src/host.js` の責務:

- Native Messaging message loop
- 受信 `type` ごとの処理
  - `ping`
  - `call_tool`
  - `list_tools`（任意）
- 例外時に共通エラー形式で返却

返却形式の例:
```json
{
  "id": "req-123",
  "ok": true,
  "result": {
    "content": [
      { "type": "text", "text": "..." }
    ]
  }
}
```

## 8. Native Host Manifest（macOS）
Native Host manifest のテンプレートを用意し、インストールスクリプトで実体化する。

配置先（ユーザー単位）:
`~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.yuki777.chrome_ai_assist.mcp.json`

必須項目:
- `name`: `com.yuki777.chrome_ai_assist.mcp`
- `type`: `stdio`
- `path`: host実行ファイルの絶対パス
- `allowed_origins`: `chrome-extension://<EXTENSION_ID>/`

`<EXTENSION_ID>` は unpacked 拡張のIDを使用する。

## 9. macOS セットアップ手順（開発者向け）
## 9.1 拡張IDの確認
`chrome://extensions` を開き、対象拡張の ID を控える。

## 9.2 Native Host の準備
`native-host/` で `npm install` を実行。  
必要なら `node` 実行用に `chmod +x` を設定。

## 9.3 manifest 配置
`native-host/scripts/install-host-manifest-macos.sh` を実行し、manifest を配置。

スクリプト引数例:
```bash
./native-host/scripts/install-host-manifest-macos.sh \
  --extension-id <EXTENSION_ID> \
  --host-path "/Users/you/git/chrome-ai-assist/native-host/src/host.js"
```

## 9.4 環境変数
Native Host 起動時に参照できるように以下を設定。

- `BACKLOG_DOMAIN`
- `BACKLOG_API_KEY`
- `DOCBASE_DOMAIN`
- `DOCBASE_API_TOKEN`

PoCでは `host.js` 内で `process.env` 参照で可。  
本番化時は macOS `launchd` や安全な秘密情報注入手段を別途検討。

## 10. 動作確認シナリオ
## 10.1 接続確認
- `background.js` から `type: "ping"` を送る
- `pong` が返る

## 10.2 Backlog ツール確認
- `server: "backlog"`, `tool: "get_issue"`
- `issueIdOrKey` を渡して結果が返る

## 10.3 DocBase ツール確認
- `server: "docbase"` で `search_posts` など軽量ツールを実行
- 結果件数やタイトルが返る

## 10.4 エラー確認
- 存在しないツール名
- 認証トークンなし
- Host未登録

それぞれでエラーメッセージがUI上に表示されること。

## 11. 受け入れ条件（DoD）
- 拡張から Native Host へ接続し、`ping` 成功
- Backlog 1ツール、DocBase 1ツールの実行成功
- 失敗時に `requestId` 付きでエラー追跡できる
- `stdout` 汚染がなく、Native Messaging プロトコルエラーが発生しない
- 拡張再読み込み後も再接続できる

## 12. よくある失敗と対策
- Host not found  
  - manifest 配置先、`name`、ファイル名を再確認
- Access forbidden  
  - `allowed_origins` の拡張ID不一致を修正
- Error when communicating with native host  
  - `stdout` へのデバッグ出力を削除（`stderr` に寄せる）
- Native host exited  
  - `host.js` の例外を捕捉し、致命エラー時のログを出す

## 13. セキュリティ注意点
- APIキーは拡張の `chrome.storage.local` に置かず、Native Host 側で扱う方が安全
- `call_tool` で許可する `server` / `tool` を allowlist で制限
- 返却データの最大サイズを制限し、UIフリーズを防ぐ

## 14. 実装順序（推奨）
1. Native Host を `ping` だけで動かす  
2. `background.js` から `ping` 成功させる  
3. Backlog 1ツールを接続  
4. DocBase 1ツールを接続  
5. タイムアウト・再接続・エラー表示を整備

## 15. 参考
- Chrome Extensions Native Messaging  
  - https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging
- backlog-mcp-server（shueisha版）  
  - https://github.com/shueisha-arts-and-digital/backlog-mcp-server
- docbase-mcp-server（shueisha版）  
  - https://github.com/shueisha-arts-and-digital/docbase-mcp-server
