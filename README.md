# My Stack-chan

M5Stack CoreS3を使用した、個人向けのカスタムStack-chanプロジェクトです。

[schroneko/stackchan-nukoevi](https://github.com/schroneko/stackchan-nukoevi) をベースに、ファームウェアや音声通信などを自分の環境に合わせてカスタマイズしています。

## Project Structure

| ディレクトリ | 内容 |
|---|---|
| `firmware/` | ESP-IDF / C++によるファームウェア |
| `channels/` | AIとの通信・連携処理 |
| `app/` | StackChanアプリケーション |
| `server/` | サーバー関連コード |
| `docs/` | 技術資料・ドキュメント |
| `tools/` | 開発用ツール |

## Based on

このプロジェクトは、以下のオープンソースプロジェクトをベースにしています。

- [Nukoevi StackChan](https://github.com/schroneko/stackchan-nukoevi)
- [M5Stack StackChan](https://github.com/m5stack/StackChan)
- [StackChan BSP](https://github.com/m5stack/StackChan-BSP)
- [Xiaozhi ESP32](https://github.com/78/xiaozhi-esp32)

## License

本プロジェクトにはMITライセンスが適用されるコードが含まれています。

著作権・ライセンスの詳細については、[LICENSE](LICENSE) および [NOTICE.md](NOTICE.md) を参照してください。

外部ライブラリや画像素材には、それぞれ独自の利用条件が適用される場合があります。
