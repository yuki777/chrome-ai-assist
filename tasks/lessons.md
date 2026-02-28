# Lessons Learned

## Backlog MCP Server（公式 nulab版）

### パラメータ名の違い
- 旧 shueisha-arts版: `issueIdOrKey` (単一パラメータ)
- 公式 nulab版: `issueId` (number) / `issueKey` (string) の2パラメータ
- 数値IDで渡す場合は `issueId: Number(val)`、文字列キー(PROJ-123)は `issueKey: val`

### --dynamic-toolsets vs --enable-toolsets
- `--dynamic-toolsets` は接続後に `activate_toolset` を呼ぶ必要があるが、Native Host経由では初回呼び出し時にツールが見つからないタイミング問題がある
- `--enable-toolsets issue` を使えば接続時から issue ツール群が有効になる（こちらが安定）
