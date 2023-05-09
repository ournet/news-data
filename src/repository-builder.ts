import DynamoDB = require("aws-sdk/clients/dynamodb");
import {
  NewsRepository,
  EventRepository,
  ArticleContentRepository
} from "@ournet/news-domain";
import { DynamoNewsRepository } from "./news/dynamo-news-repository";
import { DynamoEventRepository } from "./events/dynamo-event-repository";
import { DynamoArticleContentRepository } from "./article-content/dynamo-article-content-repository";

const VERSION_SUFFIX = "v0";

export class NewsRepositoryBuilder {
  static build(
    client: DynamoDB.DocumentClient,
    esHost: string | Record<string, any>,
    tableSuffix?: string
  ): NewsRepository {
    return new DynamoNewsRepository(
      client,
      esHost,
      tableSuffix || VERSION_SUFFIX
    );
  }
}

export class EventRepositoryBuilder {
  static build(
    client: DynamoDB.DocumentClient,
    tableSuffix?: string
  ): EventRepository {
    return new DynamoEventRepository(client, tableSuffix || VERSION_SUFFIX);
  }
}

export class ArticleContentRepositoryBuilder {
  static build(
    client: DynamoDB.DocumentClient,
    tableSuffix?: string
  ): ArticleContentRepository {
    return new DynamoArticleContentRepository(
      client,
      tableSuffix || VERSION_SUFFIX
    );
  }
}
