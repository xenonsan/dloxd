# Bloxd Direct SW Proxy v0.5.0

Performance release. Code 3対策のCookie/User-Agent/Origin/Referer/WebSocket query転送を維持しつつ、ゲーム中のメッセージ単位ログを廃止しました。

- WebSocketはカウンタ加算とバイナリ転送のみ
- 切断時だけメッセージ数・バイト数を1行記録
- HTTP成功ログを廃止し、エラーまたは2秒以上の応答のみ記録
- HTTP/HTTPS Keep-Aliveを有効化
- ログ出力をWriteStreamへ変更
- console出力を起動、警告、エラー、切断に限定
- 1006クラッシュ防止を維持

```bash
npm install
npm run check
npm start
```
