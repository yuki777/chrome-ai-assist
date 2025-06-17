# 現在
- 既存の機能により、Chrome拡張を利用してWebページの内容をAIと共有し、指示や質問ができるようになりました。

# 課題
- しかし、webページの内容をパースして、不要なコンテンツを排除して、AIに適切な情報を提供する必要があります。
- このとき、ローカルで起動しているMCP Serverがあるならばそれを利用することで簡単に実現できます。
- コンテキストが大きくなりすぎてエラーになることを抑えたり、コストを抑える効果もあります。
- 最初に対応したいのはDocBaseのドキュメントです。
- DocBaseのドキュメントは、Markdown形式で書かれており、見出しやコードブロックなどの構造が明確です。
- DocbaseのMCPサーバーは下記のように起動できます

```json
    "DocBase": {
      "command": "/Users/adachi/.volta/bin/npx",
      "args": [
        "-y",
        "@krayinc/docbase-mcp-server@latest"
      ],
      "env": {
        "DOCBASE_DOMAIN": "media-sys",
        "DOCBASE_API_TOKEN": "docbase_****************************************************************"
      }
    }
```

- 今後は、Backlog MCP Serverや、GitHub MCP Serverなど、他のMCPサーバーにも対応していく予定です。


# 対応方針
- Chrome拡張からNative Messagingを利用して、ローカルで起動しているMCP Serverと通信します。
- stdioで、JSON形式でメッセージをやり取りします。
- ドキュメントを詳細に読み込んでから実装に取り掛かります。
  - https://developer.mozilla.org/ja/docs/Mozilla/Add-ons/WebExtensions/Native_messaging
  - https://developer.mozilla.org/ja/docs/Mozilla/Add-ons/WebExtensions/Native_manifests
  - https://developer.chrome.com/docs/apps/nativeMessaging?hl=ja#native-messaging-host-location
