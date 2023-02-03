import DynamoDB = require("aws-sdk/clients/dynamodb");
import { DynamoItem } from "dynamo-item";
import { NewsItem } from "@ournet/news-domain";
import { Locale } from "../common";

export interface DynamoNewsItem extends NewsItem {
  /** COUNTRY_LANG */
  locale: string;
}

export class DynamoNewsItemHelper {
  static createLocaleKey(locale: Locale) {
    return `${locale.country.toUpperCase()}_${locale.lang.toUpperCase()}`;
  }

  static mapFromNews(data: NewsItem) {
    const item: DynamoNewsItem = {
      ...data,
      locale: DynamoNewsItemHelper.createLocaleKey(data)
    };

    return item;
  }

  static mapToNews(item: DynamoNewsItem) {
    delete item.locale;

    const data = item as NewsItem;

    return data;
  }

  static mapFromPartialNews(data: Partial<NewsItem>) {
    const item: Partial<DynamoNewsItem> = { ...data };
    return item;
  }
}

export type NewsItemKey = {
  id: string;
};

export class NewsItemModel extends DynamoItem<NewsItemKey, DynamoNewsItem> {
  localeIndexName() {
    return "locale-index";
  }
  sourceIndexName() {
    return "source-index";
  }
  eventIndexName() {
    return "event-index";
  }
  constructor(client: DynamoDB.DocumentClient, tableSuffix: string) {
    super(
      {
        hashKey: {
          name: "id",
          type: "S"
        },
        name: "news",
        tableName: `ournet_news_${tableSuffix}`,
        indexes: [
          {
            name: "source-index",
            hashKey: {
              name: "sourceId",
              type: "S"
            },
            rangeKey: {
              name: "publishedAt",
              type: "S"
            },
            type: "GLOBAL",
            projection: {
              type: "KEYS_ONLY"
            }
          },
          {
            name: "event-index",
            hashKey: {
              name: "eventId",
              type: "S"
            },
            rangeKey: {
              name: "publishedAt",
              type: "S"
            },
            type: "GLOBAL",
            projection: {
              type: "KEYS_ONLY"
            }
          },
          {
            name: "locale-index",
            hashKey: {
              name: "locale",
              type: "S"
            },
            rangeKey: {
              name: "publishedAt",
              type: "S"
            },
            type: "GLOBAL",
            projection: {
              type: "KEYS_ONLY"
            }
          }
        ]
      },
      client as any
    );
  }
}
