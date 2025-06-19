# Active Context: Chrome AI Assist

## 現在の作業フォーカス

### MCP (Model Context Protocol) 機能実装完了 (2025-06-18)
- **実装状況**: DocBase MCP Server対応が完了、Native Messaging Host実装済み
- **機能詳細**: 
  - Native Host (`native-host/host.js`) による Chrome拡張機能とMCPサーバー間の橋渡し
  - MCP Client (`src/background/mcpClient.js`) でのMCP通信管理
  - DocBaseページ自動認識とMCP処理の自動トリガー
  - サイドバーでのMCP情報表示とデバッグ機能
- **対応MCPサーバー**: DocBase (投稿詳細取得、検索機能)
- **今後の予定**: GitHub MCP Server、Backlog MCP Server対応
- **効果**: ローカルツールとの統合によるAI機能の大幅拡張

### popup ファイル削除によるコード整理 (2025-01-06 完了)
- **課題**: sidebarを使うようになったため、popup(popup.html, popup.js, popup.css)が不要になった
- **調査結果**: manifest.jsonでdefault_popupが設定されておらず、拡張機能アイコンクリックでsidebarが直接開く仕組み
- **実施内容**: 
  - `src/popup/` ディレクトリとすべてのファイルを削除
  - README.mdの使用方法とプロジェクト構造を更新
  - memory-bank/techContext.mdとsystemPatterns.mdのアーキテクチャ情報を更新
- **効果**: 約3KBのコード削減、プロジェクト構造の簡素化

### initializeChat()システムプロンプト改善 (2025-01-06 完了)
- **問題解決**: ページ内容に関連した追加質問（MediaConvertコスト調査等）にAIが過度に制限的
- **改善内容**: より柔軟で実用的なシステムプロンプトに全面改修
  - 3段階の優先順位付き対応方針を明確化
  - 出典の明示義務化（ページ内容 vs 一般知識の区別）
  - 関連する一般的質問への積極的対応を指示
  - ユーザーにとって有用で実用的なAIアシスタントとしての役割強化
- **技術的変更**: 
  - より詳細な対応ガイドライン追加
  - 避けるべき対応の明確化
  - 調査提案機能の追加
- **期待効果**: ページコンテンツベースの質問から関連する一般的質問まで幅広く対応可能

### AWS Bedrock認証実装 (完了)
- AWS Signature V4認証の完全実装により「Missing Authentication Token」エラーを解決
- AWS Access Key, Secret Key, Session Token, Regionを使用した正しい認証ヘッダー生成
- sha256, hmacSha256等の暗号化関数をWeb Crypto APIで実装
- 利用可能な最新Bedrockモデル（Claude 3.5 Sonnet v2, Claude 3.5 Haiku等）に更新

### Native Messaging Host実装 (完了)
- Chrome拡張機能とMCPサーバー間の橋渡し機能実装
- StdioClientTransportによるMCPクライアント管理
- 複数のホスト版（real/simple/mock）による開発・テスト対応
- 自動的なNative Messaging Hostマニフェスト設置

### システムプロンプト改善 & API統合修正 (完了)
- AIがページコンテンツを正確に理解し応答するための詳細なプロンプト実装
- ページ内容に基づいた正確な回答を提供するよう明確に指示
- 一般知識ではなくページコンテンツの参照を重視
- 回答時の参照箇所明示を要求
- **重要修正**: OpenAI/AnthropicのAPI呼び出しでシステムプロンプトが正常に送信されるよう修正
  - OpenAI: systemメッセージをmessages配列の最初に追加
  - Anthropic: systemパラメータとして送信
  - Bedrock: systemパラメータ使用（認証追加で完全動作）

### デバッグ情報表示機能 (完了)
- AI Chat画面にデバッグパネルを追加
- 現在のAIモデル、プロンプト、コンテキスト情報を表示
- API呼び出しの詳細情報とパフォーマンス測定
- デバッグ情報のコピー、エクスポート機能

### 現在のプロジェクト状態
- **基本機能**: 実装済み・動作可能
- **UI/UX**: sidebar中心の統一されたインターフェース
- **AI統合**: 3プロバイダー対応済み (AWS Bedrock, OpenAI, Anthropic)
- **MCP統合**: DocBase MCP Server対応済み、Native Messaging Host実装済み
- **セキュリティ**: 基本的な対策実装済み
- **コード整理**: 不要なpopup関連ファイルを削除済み
- **デバッグ機能**: MCP接続状況、AI応答のデバッグ情報表示

## 最近の変更・発見

### MCPアーキテクチャ実装 (2025-06-18)
- **実装内容**: 
  - Native Host (`native-host/host.js`) - Chrome拡張機能とMCPサーバー間の橋渡し
  - MCP Client (`src/background/mcpClient.js`) - MCPメッセージの送受信とエラーハンドリング
  - DocBase MCP Server統合 - 投稿詳細取得、検索機能
  - サイドバーのMCP情報表示とデバッグパネル
- **通信フロー**: Chrome拡張機能 → Native Host → MCP Server → DocBase API
- **開発支援**: 複数のホスト版（real/simple/mock）による段階的開発・テスト

### popupファイル削除 (2025-01-06)
- **削除対象**: `src/popup/popup.html`, `src/popup/popup.js`, `src/popup/popup.css`
- **理由**: sidebar実装により不要になった
- **影響**: なし（現在使用されていない状態だった）
- **更新箇所**: README.md, techContext.md, systemPatterns.md

### コード構造の理解
1. **マルチプロバイダー対応**: AWS Bedrock、OpenAI、Anthropic Claude
2. **MCP統合**: Model Context Protocol対応でローカルツール連携
3. **Native Messaging**: Chrome拡張機能とローカルプロセス間の通信
4. **動的UI制御**: API設定状況に基づく機能有効化
5. **セキュリティ重視**: XSS防止、CSP対応、権限最小化
6. **ユーザビリティ**: キーボードショートカット、状態フィードバック、デバッグ情報表示

### 技術的パターン
- Manifest V3への完全対応
- Service Workerベースのバックグラウンド処理
- Content Scriptsによるページ統合
- Chrome Storage APIの活用

## 次のステップ・優先事項

### 短期 (1-2週間)
1. **MCP機能拡張**: GitHub MCP Server、Backlog MCP Server対応
2. **機能テスト**: 既存機能の動作確認・デバッグ
3. **ドキュメント整備**: MCP機能の詳細説明、トラブルシューティング追加
4. **エラーハンドリング強化**: MCP接続エラー、Native Host通信エラーの詳細化

### 中期 (1ヶ月)
1. **パフォーマンス最適化**: MCP通信の高速化、レスポンス時間の改善
2. **UI/UX改善**: MCP情報表示の最適化、より直感的なインターフェース
3. **機能拡張**: 新しいMCPツールの追加、AI機能の拡張
4. **セキュリティ強化**: MCP通信の暗号化、認証機能の追加

### 長期 (2-3ヶ月)
1. **TypeScript移行**: 型安全性の向上
2. **テスト自動化**: Jest等のテストフレームワーク導入
3. **CI/CD構築**: 自動デプロイパイプライン

## アクティブな決定事項

### 技術選択
- **Vanilla JavaScript**: フレームワークを使わずシンプルに保つ
- **Chrome Storage**: 状態管理にChrome APIを活用
- **マルチプロバイダー**: 特定のAIサービスに依存しない設計

### 設計方針
- **セキュリティファースト**: 最小権限の原則
- **ユーザーエクスペリエンス重視**: 直感的で高速な操作性
- **拡張性**: 将来的な機能追加を容易にする構造

## 学習・インサイト

### Chrome拡張機能開発
- Manifest V3の制約と最適化手法
- Service Workerの効果的な活用方法
- Content Scriptsとの安全な通信パターン
- Native Messaging APIの活用とセキュリティ考慮事項

### MCP (Model Context Protocol) 統合
- Chrome拡張機能からローカルツールへの安全な接続方法
- StdioClientTransportによる効率的なMCP通信
- エラーハンドリングとデバッグ情報の重要性
- 複数のホスト版による段階的開発の有効性

### AI統合のベストプラクティス
- 複数プロバイダーの統一インターフェース設計
- API率限制とエラーハンドリング
- ユーザーのプライバシー保護

### 重要な実装パターン
- 非同期処理の一貫した処理方法
- UIの動的な状態管理
- エラー情報のユーザーフレンドリーな表示

## プロジェクトの強み
1. **シンプルで安定した構造**: 過度に複雑にせず、実用性重視
2. **セキュリティ配慮**: Chrome拡張機能のベストプラクティス準拠  
3. **マルチプロバイダー対応**: 特定サービスへの依存リスク軽減
4. **MCP統合**: ローカルツールとの柔軟な連携によるAI機能拡張
5. **ユーザビリティ**: キーボードショートカット、デバッグ情報表示等の利便性機能
6. **開発者フレンドリー**: 複数のホスト版による段階的開発・テスト対応

## 現在の課題・注意点
1. **テストの不足**: 手動テストのみで自動テストなし、特にMCP通信の自動テスト
2. **エラーハンドリング**: MCP接続エラー、Native Host通信エラーの詳細なユーザーガイダンス
3. **パフォーマンス**: 大きなページでの処理速度最適化、MCP通信の高速化余地あり
4. **ドキュメント**: MCP機能の詳細説明、Native Hostセットアップ手順の整備が必要
5. **セキュリティ**: MCP通信の暗号化、APIトークンの安全な管理方法の検討
6. **拡張性**: 新しいMCPサーバー追加の標準化されたプロセス
