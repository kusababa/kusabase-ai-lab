---
title: "Amazon Bedrock、Anthropic Claudeモデル全てで構造化出力に対応 - JSON Schema準拠レスポンスが標準機能に"
description: "Amazon BedrockがbedrockランタイムとbedrockMantleの両エンドポイントでAnthropic Claudeモデルの構造化出力をサポート開始。JSON Schemaとstrict tool useにより、カスタムパース処理やリトライロジックなしでスキーマ準拠のJSONを取得可能に。"
publishDate: 2026-10-20
category: "Development"
tags: ["Amazon Bedrock", "Anthropic Claude", "構造化出力", "JSON Schema", "AWS", "LLM開発"]
draft: false
author: "KusaBase AI Lab編集部"
---

*出典: [AWS Machine Learning Blog](https://aws.amazon.com/blogs/machine-learning/structured-outputs-for-anthropic-claude-models-on-amazon-bedrock/)*

## ニュース概要

AWSは、Amazon Bedrock上で提供される全てのAnthropic Claudeモデルに対して「構造化出力（Structured Outputs）」機能を正式にサポートすると発表した。この機能はbedrock-runtimeとbedrock-mantleの両エンドポインドで利用可能であり、JSON Schema出力フォーマットとstrict tool useを組み合わせることで、開発者が定義したスキーマに厳密に準拠したJSONレスポンスを取得できるようになる。従来必要だったカスタムパース処理、出力検証、リトライロジック、後処理といった工程を省略できる点が最大の特徴だ。

## 何が変わったか

これまでLLMからの出力は自然言語生成の性質上、意図した形式から逸脱するケースが一定数発生し、開発者側でJSON妥当性検証や失敗時の再試行処理を実装する必要があった。今回の対応により、Bedrock側でJSON Schemaに基づく出力制約をモデルレベルで保証する仕組みが導入され、Claudeモデル全般（Haiku、Sonnet、Opus系列を含む想定）で一律に利用可能となった。特筆すべきは、推論専用のbedrock-runtimeだけでなく、より広範なユースケースに対応するbedrock-mantleエンドポイントでも同機能が提供される点で、Bedrockのプラットフォーム全体としての機能整合性が強化されたことを意味する。

## 開発者への影響

開発者にとっては、API連携やデータベース登録、他システムとの連携を前提としたアプリケーション開発において、出力の信頼性が大きく向上する。特にエージェント型アプリケーションやツール呼び出しを多用するワークフローでは、パース失敗によるエラーハンドリングのコストが大幅に削減される。また、スキーマ定義さえ行えば型安全性に近い開発体験が得られるため、Pydanticやzodなどのスキーマ検証ライブラリとの連携もスムーズになり、プロダクション環境へのLLM機能実装の障壁が下がる。一方で、スキーマ設計の複雑さや、strict modeが生成の柔軟性・創造性にどう影響するかは、ユースケースごとに検証が必要になるだろう。

## KusaBase視点の考察

この発表はOpenAIが先行して提供してきたstructured outputsやfunction callingの厳格モードに対する、AWS・Anthropic陣営からの事実上のキャッチアップと言える。重要なのは、単一モデル提供者の機能としてではなく「クラウドプラットフォーム（Bedrock）が複数エンドポイントで統一的に保証する」という形で実装された点だ。これはエンタープライズ利用において、モデルベンダーの違いを意識せずに同一の開発体験を提供するというAWSの戦略を反映している。KusaBaseとしては、こうした「出力の信頼性担保」がLLMアプリケーション開発の次のコモディティ化領域になると見ている。今後はスキーマ準拠率そのものが各クラウドベンダーの差別化要素ではなく、むしろ前提条件となり、開発者はスキーマ設計やエージェント設計といった上流の思考に時間を割けるようになる。地味な機能拡張に見えるが、プロダクション運用コストを左右する実務的インパクトは大きい。

## 今後の予測

今後、構造化出力はBedrockに限らずGoogle VertexやAzure OpenAI Serviceなど主要クラウドAIプラットフォーム全体で標準機能化が進むと予想される。特にマルチエージェントシステムやRAGパイプラインにおいて、ツール呼び出しの正確性がシステム全体の信頼性を左右するため、この種の「出力保証」機能は今後さらに高度化し、ネストされた複雑なスキーマや条件分岐を含むスキーマへの対応、レイテンシ最適化などが次の競争軸になるだろう。また、AnthropicがBedrock経由で機能を拡充する動きは、直接APIとクラウド経由利用の機能差を縮める流れとも整合しており、企業のマルチクラウド戦略下でのClaude採用をさらに後押しする可能性がある。
