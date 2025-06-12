# アイコンファイル

Chrome AI Assistの拡張機能アイコンファイルをこのディレクトリに配置してください。

## 必要なファイル

以下のサイズのPNGファイルが必要です：

- `icon16.png` - 16x16ピクセル (ツールバーアイコン)
- `icon48.png` - 48x48ピクセル (拡張機能管理ページ)
- `icon128.png` - 128x128ピクセル (Chrome Web Store、インストール時)

## デザインガイドライン

### 推奨デザイン
- **ベースカラー**: グラデーション (#667eea → #764ba2)
- **モチーフ**: AIチップ、脳、チャット、レイヤーのアイコン
- **スタイル**: モダン、ミニマル、フラットデザイン

### 技術仕様
- **フォーマット**: PNG (透明背景推奨)
- **解像度**: 各サイズに最適化
- **透明度**: 背景は透明、アイコン部分は不透明

## アイコン生成方法

### オプション1: SVGからの変換
```svg
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea"/>
      <stop offset="100%" style="stop-color:#764ba2"/>
    </linearGradient>
  </defs>
  <circle cx="64" cy="64" r="56" fill="url(#grad)"/>
  <path d="M64 16L16 40L64 64L112 40L64 16Z" fill="white" opacity="0.9"/>
  <path d="M16 88L64 112L112 88" stroke="white" stroke-width="4" fill="none" opacity="0.9"/>
  <path d="M16 64L64 88L112 64" stroke="white" stroke-width="4" fill="none" opacity="0.9"/>
</svg>
```

### オプション2: デザインツール
- Figma、Sketch、Adobe Illustratorなどを使用
- 上記のSVGコードをベースに調整

### オプション3: オンラインジェネレーター
- [Flaticon](https://www.flaticon.com/)
- [IconFinder](https://www.iconfinder.com/)
- [Icon8](https://icons8.com/)

## アイコンファイルの配置

1. 生成したアイコンファイルをこのディレクトリ（`icons/`）に配置
2. ファイル名は正確に以下の通りにしてください：
   - `icon16.png`
   - `icon48.png` 
   - `icon128.png`

## 確認方法

1. Chrome拡張機能を再読み込み
2. 以下で正しく表示されることを確認：
   - ブラウザツールバーのアイコン
   - 拡張機能管理ページ（chrome://extensions/）
   - ポップアップ表示時

## 注意事項

- アイコンファイルが存在しない場合、Chromeのデフォルトアイコンが表示されます
- ファイル名や配置場所が間違っていると正しく読み込まれません
- 各サイズでの視認性を確認してください（特に16x16は小さいため）

---

現在このプロジェクトにはプレースホルダーアイコンが含まれていません。
実際に使用する前に、上記のガイドラインに従ってアイコンファイルを作成・配置してください。
