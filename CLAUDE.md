# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Chrome AI Assist - WebページのコンテンツをAIと共有して対話できるChrome拡張機能

## アーキテクチャ

### コンポーネント間の通信フロー
```
Webページ → Content Script → Background Service Worker → AI API
    ↑                ↓                    ↓
    └─── Sidebar UI ←─────────────────────┘
```

### 主要コンポーネントの役割

1. **Background Service Worker** (`src/background/background.js`)
   - 全メッセージの中継ハブ
   - AI API呼び出し（AWS Bedrock、OpenAI、Anthropic）
   - AWS署名v4実装を含む

2. **Content Script** (`src/content/content.js`)
   - ページコンテンツの抽出（`extractPageContent()`）
   - サイドバーiframeの管理
   - フローティングボタンの制御

3. **Sidebar** (`src/sidebar/sidebar.js`)
   - チャットUIの管理
   - メッセージ履歴の永続化（1ヶ月保持）
   - Content Scriptとの双方向通信

## 開発方法

1. Chrome拡張機能の開発者モードを有効化
2. 「パッケージ化されていない拡張機能を読み込む」でプロジェクトフォルダを選択
3. 変更後は拡張機能を再読み込み

## 重要な実装パターン

### メッセージパッシング
- Content Script → Background: `chrome.runtime.sendMessage`
- Background → Content Script: `chrome.tabs.sendMessage`
- Content Script ↔ Sidebar: `window.postMessage`（iframeの制約のため）

### ストレージ
- API設定: `chrome.storage.local`
- チャット履歴: `chrome.storage.local`（`chatHistory_`プレフィックス）

### セキュリティ考慮事項
- APIキーはローカルストレージに保存
- プロンプトインジェクション対策実装済み
- CSPヘッダー設定済み