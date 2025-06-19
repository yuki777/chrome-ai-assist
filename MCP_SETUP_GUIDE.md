# MCP設定ガイド

Chrome AI AssistでMCP (Model Context Protocol) Serverを使用するための設定手順です。

## 設定手順

1. **Chrome拡張機能のオプションページを開く**
   - 拡張機能のアイコンを右クリック → 「オプション」を選択
   - または、サイドバーの設定ボタン（⚙️）をクリック

2. **MCP Server Configurationセクションまでスクロール**
   - ページ下部にある「MCP Server Configuration」セクションを探します

3. **MCP設定をJSON形式で入力**
   - 既存のMCP設定ファイル（cline_docs/config.json等）の内容をコピー＆ペースト
   - または、以下のサンプルを参考に設定を記述

4. **設定を保存**
   - 「JSON検証」ボタンで設定の妥当性を確認
   - 「設定を保存」ボタンをクリック

## 設定サンプル

### DocBase MCP Server
```json
{
  "mcpServers": {
    "docbase": {
      "command": "npx",
      "args": ["-y", "@krayinc/docbase-mcp-server"],
      "env": {
        "DOCBASE_DOMAIN": "your-team",
        "DOCBASE_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

### GitHub MCP Server
```json
{
  "mcpServers": {
    "github": {
      "command": "/usr/local/bin/docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "GITHUB_PERSONAL_ACCESS_TOKEN",
        "ghcr.io/github/github-mcp-server"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

### 複数サーバーの設定
```json
{
  "mcpServers": {
    "docbase": {
      "command": "npx",
      "args": ["-y", "@krayinc/docbase-mcp-server"],
      "env": {
        "DOCBASE_DOMAIN": "your-team",
        "DOCBASE_API_TOKEN": "your-api-token"
      }
    },
    "github": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "ghcr.io/github/github-mcp-server"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

## 自動サーバー選択

Chrome AI Assistは、開いているページのURLに基づいて適切なMCPサーバーを自動的に選択します：

- `docbase.io` を含むURL → `docbase` サーバー
- `github.com` を含むURL → `github` サーバー
- `backlog` を含むURL → `backlog` サーバー

## 動作確認

1. 対応サイト（DocBase、GitHub等）のページを開く
2. Chrome AI Assistのサイドバーを開く
3. デバッグパネル（右上の虫アイコン）で以下を確認：
   - MCP Native Host: 接続済み（緑色）
   - 該当サーバー Status: 接続済み（緑色）
   - MCP Tools: 利用可能なツールが表示される

## トラブルシューティング

### MCP Native Hostが「未接続」の場合

1. Native Hostが正しくインストールされているか確認：
   ```bash
   cd native-host
   ./install.sh
   ```

2. Chrome拡張機能を再読み込み

### サーバー Statusが「未接続」の場合

1. JSON設定が正しく入力されているか確認
2. 必要なフィールド（command, args, env）が含まれているか確認
3. APIトークンやキーが正しく設定されているか確認
4. コマンドパスが正しいか確認（npx, docker等）
5. ネットワーク接続を確認

### 設定のリセット

設定をリセットする場合は、オプションページで以下を実行：
1. MCP設定のJSONフィールドを空にする
2. 「設定を保存」をクリック

## 注意事項

- `autoApprove`、`timeout`、`type` フィールドは自動的に処理されるため、設定に含める必要はありません
- 環境変数は `env` フィールドに設定してください
- コマンドへのパスは環境に応じて調整してください

## セキュリティに関する注意

- APIトークンはローカルに保存され、Native Host経由でのみ使用されます
- APIトークンは他の拡張機能やWebサイトからアクセスできません
- APIトークンは定期的に更新することを推奨します