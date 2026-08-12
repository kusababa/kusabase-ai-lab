# LINE公式アカウントによる新着記事通知

新しい記事が`main`にマージされて公開されると、`.github/workflows/deploy.yml`のデプロイ完了後に`scripts/notify-line.ts`が起動し、LINE公式アカウントの友だち全員へMessaging APIの[ブロードキャストメッセージ](https://developers.line.biz/ja/reference/messaging-api/#send-broadcast-message)でお知らせする。**対象は新規追加された記事のみで、既存記事の編集では通知しない。**

このドキュメントは、その配信を有効化するためにユーザー自身が行う手動セットアップ手順である（コード側の実装は完了済み）。

## 1. LINE公式アカウント（プロバイダー）の作成

1. [LINE Developersコンソール](https://developers.line.biz/console/)にLINEアカウントでログインする
2. 新規プロバイダーを作成する（例: `KusaBase`）
3. 作成したプロバイダー配下に「Messaging API」チャンネルを新規作成する（チャンネル名: 例 `KusaBase AI Lab` / 業種・メールアドレス等の必須項目を入力）

## 2. チャンネルアクセストークンの発行

1. 作成したMessaging APIチャンネルの管理画面 → 「Messaging API設定」タブを開く
2. 「チャンネルアクセストークン（長期）」を発行する
3. 発行されたトークンをコピーする（この後GitHub Secretsに登録する）

> 応答メッセージ機能（Webhook）は今回使わないため、初期設定のままでよい。

## 3. GitHub Secretsへの登録

リポジトリの Settings → Secrets and variables → Actions に以下を追加する。

| Secret名 | 内容 |
| --- | --- |
| `LINE_CHANNEL_ACCESS_TOKEN` | 手順2で発行したチャンネルアクセストークン |

登録すると、次回`main`へのpush（記事の新規追加を含むデプロイ）から自動的に配信が有効になる。**未設定の間は`scripts/notify-line.ts`が何もせずスキップするだけで、デプロイやビルド自体には一切影響しない。**

## 4. 友だち追加用URLをサイトに反映

1. Messaging APIチャンネル管理画面 → 「Messaging API設定」タブ内の「友だち追加ガイド」または「QRコード」欄から、`https://lin.ee/xxxxxxx` 形式の友だち追加URLを取得する
2. `src/consts.ts` の `LINE_FRIEND_URL` にそのURLを設定する

```ts
export const LINE_FRIEND_URL = 'https://lin.ee/xxxxxxx'
```

> lin.ee形式のURLが画面に表示されない場合は、代わりにBasic ID（`@`から始まるID。チャンネル基本設定タブに表示される）から `https://line.me/R/ti/p/@{Basic ID}` という形式でも同じ友だち追加リンクを作れる（QRコードの遷移先と同じ）。

未設定（空文字）の間は、トップページとフッターのLINE CTAは「準備中」表示のままになる。

## 動作確認

1. `LINE_CHANNEL_ACCESS_TOKEN`をGitHub Secretsに登録し、`LINE_FRIEND_URL`を設定してpushする
2. 自分のLINEアカウントで手順4のURLから当該公式アカウントを友だち追加する
3. `src/content/articles/`配下に新規記事ファイルを追加してmainにpush（またはAIニュースパイプラインのPRをマージ）する
4. GitHub Actionsの「Notify LINE for newly published articles」ステップのログで配信結果を確認し、実際にLINEへ通知が届くことを確認する

## 料金・配信数の上限について

LINE公式アカウントの無料プラン（コミュニケーションプラン「フリー」）は、**月間の配信数上限が200通**（友だち1人への1通ごとにカウント）。たとえば友だちが50人いれば、月4回程度のブロードキャストで上限に達する。記事公開頻度や友だち数が増えてきた場合は、有料プラン（ライトプラン以上）への切り替えを検討すること。上限超過時はLINE API側がエラーを返すのみで、`notify-line.ts`はエラーをログに記録して処理を継続する（デプロイ自体は失敗しない）。
