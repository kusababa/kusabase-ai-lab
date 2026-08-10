# AWS デプロイ手順（S3 + CloudFront + Route53 + ACM）

このドキュメントは `ai.kusabase.com` を稼働させるためのAWSインフラ構築手順である。**リポジトリ初期構築時点ではAWSリソースは未作成のため、初回デプロイ前に本手順に沿って構築すること。**

## 構成図

```
ユーザー
  ↓ HTTPS
Route 53 (ai.kusabase.com)
  ↓
CloudFront Distribution
  ↓ Origin（OAC経由）
S3 Bucket（静的ファイル、パブリックアクセスはブロックしたまま）
  ↑
  ACM（SSL証明書 / us-east-1）
```

---

## 前提条件

- AWSアカウント取得済み
- AWS CLIインストール・設定済み（`aws configure`）
- `kusabase.com` のRoute 53ホストゾーンが既存管理下にあること（`ai` サブドメインを追加する）
- Node.js 20+ インストール済み

---

## 1. ビルド

```bash
npm install
npm run build
# dist/ に静的ファイル一式（Pagefindインデックス含む）が出力される
```

---

## 2. S3バケット作成

```bash
aws s3 mb s3://ai.kusabase.com --region ap-northeast-3
```

CloudFrontのOAC（Origin Access Control）経由でのみアクセスさせるため、S3のパブリックアクセスはブロックしたままにする（静的ウェブサイトホスティング機能は有効化しない）。

### バケットポリシー（CloudFront OAC用）

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::ai.kusabase.com/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID"
        }
      }
    }
  ]
}
```

`ACCOUNT_ID` / `DISTRIBUTION_ID` はCloudFront作成後に確定するため、Distribution作成後にポリシーを更新する。

---

## 3. ACM（SSL証明書）取得

> ⚠️ CloudFront用の証明書は必ず **us-east-1（バージニア北部）** リージョンで発行すること

```bash
aws acm request-certificate \
  --domain-name ai.kusabase.com \
  --validation-method DNS \
  --region us-east-1
```

Route 53に検証用CNAMEレコードを追加し、証明書の検証を完了させる。証明書ARNは後続の手順で使用する。

---

## 4. CloudFrontディストリビューション作成

| 項目 | 設定値 |
| --- | --- |
| Origin domain | `ai.kusabase.com.s3.ap-northeast-3.amazonaws.com` |
| Origin access | Origin access control settings（OAC） |
| Viewer protocol policy | Redirect HTTP to HTTPS |
| Allowed HTTP methods | GET, HEAD |
| Cache policy | CachingOptimized |
| Alternate domain names | `ai.kusabase.com` |
| Custom SSL certificate | 手順3で取得したACM証明書（us-east-1） |
| Default root object | `index.html` |

### カスタムエラーページ設定

| HTTP Error Code | Response page path | HTTP Response code |
| --- | --- | --- |
| 404 | `/404.html` | 404 |

---

## 5. Route 53設定

既存の `kusabase.com` ホストゾーンに、`ai` サブドメイン用のAレコード（エイリアス）を追加する。

```
ホストゾーン: kusabase.com

Aレコード（エイリアス）:
  名前: ai.kusabase.com
  値: CloudFrontディストリビューションのドメイン名
```

---

## 6. 手動デプロイ（初回確認用）

```bash
# 長期キャッシュ対象（HTML/robots/sitemap/rss/pagefind、ファイル名固定のブランド画像を除く）
# ※ logo.svg・og-default.svg・images/* はAstroのハッシュ付きファイル名によるキャッシュバスティングが
#   効かない（ファイル名固定のまま中身だけ差し替える運用のため）ので、長期キャッシュから除外している
aws s3 sync dist/ s3://ai.kusabase.com \
  --delete \
  --exclude "*.html" \
  --exclude "robots.txt" \
  --exclude "sitemap*.xml" \
  --exclude "rss.xml" \
  --exclude "pagefind/*" \
  --exclude "logo.svg" \
  --exclude "og-default.svg" \
  --exclude "AILab_icon.png" \
  --exclude "AILab_logo.png" \
  --exclude "images/*" \
  --cache-control "public, max-age=31536000, immutable"

# no-cache対象
aws s3 sync dist/ s3://ai.kusabase.com \
  --exclude "*" \
  --include "*.html" \
  --include "robots.txt" \
  --include "sitemap*.xml" \
  --include "rss.xml" \
  --include "pagefind/*" \
  --include "logo.svg" \
  --include "og-default.svg" \
  --include "AILab_icon.png" \
  --include "AILab_logo.png" \
  --include "images/*" \
  --cache-control "public, max-age=0, must-revalidate"

# CloudFrontキャッシュ無効化
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

以降は `main` ブランチへのpushで `.github/workflows/deploy.yml` が同じ手順を自動実行する。

---

## 7. GitHub Secretsの設定

リポジトリの Settings → Secrets and variables → Actions に以下を登録する。

| Secret名 | 内容 |
| --- | --- |
| `AWS_ACCESS_KEY_ID` | デプロイ用IAMユーザーのアクセスキー |
| `AWS_SECRET_ACCESS_KEY` | 同シークレットキー |
| `S3_BUCKET` | `ai.kusabase.com` |
| `CLOUDFRONT_DISTRIBUTION_ID` | 手順4で作成したDistributionのID |

デプロイ用IAMユーザーには、対象S3バケットへの `s3:PutObject` / `s3:DeleteObject` / `s3:ListBucket` と、対象CloudFront Distributionへの `cloudfront:CreateInvalidation` の権限のみを付与する（最小権限の原則）。

---

## コスト目安

| サービス | 月額目安 |
| --- | --- |
| S3 | ~$0.03 |
| CloudFront | ~$1〜3（トラフィックによる） |
| Route 53 | 追加コストなし（既存ホストゾーンへのレコード追加のみ） |
| ACM | 無料 |
| **合計** | **~$1〜3/月** |
