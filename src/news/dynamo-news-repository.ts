const debug = require("debug")("ournet:news-data");

import DynamoDB = require("aws-sdk/clients/dynamodb");
import {
  BaseRepository,
  RepositoryUpdateData,
  RepositoryAccessOptions,
  Dictionary,
  uniq
} from "@ournet/domain";

import {
  NewsItem,
  NewsRepository,
  LatestNewsQueryParams,
  LatestNewsByTopicQueryParams,
  CountNewsQueryParams,
  CountNewsByTopicQueryParams,
  CountNewsBySourceQueryParams,
  LatestNewsBySourceQueryParams,
  Topic,
  NewsItemValidator,
  TopItem,
  NewsSearchParams,
  LatestNewsByEventQueryParams,
  CountNewsByEventQueryParams
} from "@ournet/news-domain";

import { DynamoNewsItemHelper, NewsItemModel } from "./dynamo-news";
import { TopicNewsModel, TopicNewsHelper } from "./topic-news";
import { NewsSearcher } from "./news-searcher";
import { sortEntitiesByIds, buildDateRangeKey } from "../helpers";
import { Locale } from "../common";

export class DynamoNewsRepository
  extends BaseRepository<NewsItem>
  implements NewsRepository
{
  protected model: NewsItemModel;
  protected topicNewsModel: TopicNewsModel;
  protected searcher: NewsSearcher;

  constructor(
    client: DynamoDB.DocumentClient,
    esHost: string,
    tableSuffix: string
  ) {
    super(new NewsItemValidator());
    this.model = new NewsItemModel(client, tableSuffix);
    this.topicNewsModel = new TopicNewsModel(client, tableSuffix);
    this.searcher = new NewsSearcher(esHost);
  }

  async viewNewsItem(id: string) {
    const item = await this.model.get(
      { id },
      { attributes: ["id", "countViews"] }
    );

    if (!item) {
      throw new Error(`Not found news item id=${id}`);
    }

    const countViews = item.countViews + 1;

    await this.update({ id, set: { countViews } });

    return countViews;
  }

  async innerCreate(data: NewsItem) {
    const createdItem = await this.model.create(
      DynamoNewsItemHelper.mapFromNews(data)
    );

    const item = DynamoNewsItemHelper.mapToNews(createdItem);

    if (item.topics) {
      await this.putTopicNews(
        item,
        item.id,
        item.publishedAt,
        item.topics,
        data.expiresAt
      );
    }

    await this.searcher.index(item);

    return item;
  }

  async innerUpdate(data: RepositoryUpdateData<NewsItem>) {
    const updatedItem = await this.model.update({
      remove: data.delete,
      key: { id: data.id },
      set: data.set && DynamoNewsItemHelper.mapFromPartialNews(data.set)
    });

    const item = DynamoNewsItemHelper.mapToNews(updatedItem);

    return item;
  }

  async delete(id: string) {
    const oldItem = await this.model.delete({ id });
    return !!oldItem;
  }

  async exists(id: string) {
    const item = await this.getById(id, { fields: ["id"] });

    return !!item;
  }

  async getById(id: string, options?: RepositoryAccessOptions<NewsItem>) {
    const item = await this.model.get(
      { id },
      options && { attributes: options.fields }
    );

    if (!item) {
      return item;
    }

    return DynamoNewsItemHelper.mapToNews(item);
  }

  async getByIds(ids: string[], options?: RepositoryAccessOptions<NewsItem>) {
    const items = await this.model.getItems(
      ids.map((id) => ({ id })),
      options && { attributes: options.fields }
    );

    const list = items.map((item) => DynamoNewsItemHelper.mapToNews(item));

    return sortEntitiesByIds(ids, list);
  }

  async search(
    params: NewsSearchParams,
    options?: RepositoryAccessOptions<NewsItem>
  ): Promise<NewsItem[]> {
    const searchResults = await this.searcher.search(params);

    if (!searchResults.length) {
      return [];
    }

    const ids = uniq(searchResults.map((item) => item.id)).slice(
      0,
      params.limit
    );

    return this.getByIds(ids, options);
  }

  async latest(
    params: LatestNewsQueryParams,
    options?: RepositoryAccessOptions<NewsItem>
  ) {
    const localeKey = DynamoNewsItemHelper.createLocaleKey(params);
    const rangeKey = buildDateRangeKey(params);

    const result = await this.model.query({
      index: this.model.localeIndexName(),
      attributes: options && (options.fields as string[] | undefined),
      hashKey: localeKey,
      limit: params.limit,
      rangeKey,
      order: "DESC"
    });

    if (!result.items || result.items.length === 0) {
      return [];
    }

    const ids = uniq(result.items.map((item) => item.id)).slice(
      0,
      params.limit
    );

    return this.getByIds(ids, options);
  }

  async latestByTopic(
    params: LatestNewsByTopicQueryParams,
    options?: RepositoryAccessOptions<NewsItem>
  ) {
    const index = this.topicNewsModel.topicLastNewsIndexName();
    const hashKey = params.topicId;
    const rangeKey = buildDateRangeKey(params);

    const result = await this.topicNewsModel.query({
      index,
      hashKey,
      limit: params.limit,
      rangeKey,
      order: "DESC"
    });

    if (!result.items || result.items.length === 0) {
      return [];
    }

    const ids = uniq(result.items.map((item) => item.newsId)).slice(
      0,
      params.limit
    );

    return this.getByIds(ids, options);
  }

  async latestByEvent(
    params: LatestNewsByEventQueryParams,
    options?: RepositoryAccessOptions<NewsItem>
  ) {
    const rangeKey = buildDateRangeKey(params);

    const result = await this.model.query({
      index: this.model.eventIndexName(),
      hashKey: params.eventId,
      rangeKey,
      limit: params.limit,
      attributes: ["id"],
      order: "DESC"
    });

    if (!result.items || result.items.length === 0) {
      return [];
    }

    const ids = uniq(result.items.map((item) => item.id)).slice(
      0,
      params.limit
    );

    return this.getByIds(ids, options);
  }

  async latestBySource(
    params: LatestNewsBySourceQueryParams,
    options?: RepositoryAccessOptions<NewsItem>
  ) {
    const rangeKey = buildDateRangeKey(params);

    const result = await this.model.query({
      index: this.model.sourceIndexName(),
      hashKey: params.sourceId,
      rangeKey,
      limit: params.limit,
      attributes: ["id"],
      order: "DESC"
    });

    if (!result.items || result.items.length === 0) {
      return [];
    }

    const ids = uniq(result.items.map((item) => item.id)).slice(
      0,
      params.limit
    );

    return this.getByIds(ids, options);
  }

  async count(params: CountNewsQueryParams) {
    const localeKey = DynamoNewsItemHelper.createLocaleKey(params);
    const rangeKey = buildDateRangeKey(params);

    const result = await this.model.query({
      index: this.model.localeIndexName(),
      select: "COUNT",
      hashKey: localeKey,
      rangeKey
    });

    return result.count;
  }

  async countByTopic(params: CountNewsByTopicQueryParams) {
    const index = this.topicNewsModel.topicLastNewsIndexName();
    const hashKey = params.topicId;
    const rangeKey = buildDateRangeKey(params);

    const result = await this.topicNewsModel.query({
      index,
      select: "COUNT",
      hashKey,
      rangeKey
    });

    return result.count;
  }

  async countBySource(params: CountNewsBySourceQueryParams) {
    const rangeKey = buildDateRangeKey(params);

    const result = await this.model.query({
      index: this.model.sourceIndexName(),
      select: "COUNT",
      hashKey: params.sourceId,
      rangeKey
    });

    return result.count;
  }

  async countByEvent(params: CountNewsByEventQueryParams) {
    const rangeKey = buildDateRangeKey(params);

    const result = await this.model.query({
      index: this.model.eventIndexName(),
      hashKey: params.eventId,
      rangeKey,
      select: "COUNT"
    });

    return result.count;
  }

  async topSourceTopics(
    params: LatestNewsBySourceQueryParams
  ): Promise<TopItem[]> {
    const rangeKey = buildDateRangeKey(params);

    const result = await this.model.query({
      index: this.model.sourceIndexName(),
      hashKey: params.sourceId,
      limit: 100,
      rangeKey,
      order: "DESC",
      attributes: ["id"]
    });

    if (!result.items || result.items.length === 0) {
      return [];
    }

    const ids = result.items.map((item) => item.id);

    const newsItems = await this.model.getItems(
      ids.map((id) => ({ id })),
      { attributes: ["topics"] }
    );

    if (!newsItems.length) {
      debug(`Top source's topics by ids is empty`, ids);
      return [];
    }

    const topMap: Dictionary<number> = {};

    for (const item of newsItems) {
      if (item.topics && item.topics.length) {
        for (const topic of item.topics) {
          const id = topic.id;
          if (!topMap[id]) {
            topMap[id] = 1;
          } else {
            topMap[id]++;
          }
        }
      }
    }

    const topList: TopItem[] = Object.keys(topMap)
      .map((id) => ({ id, count: topMap[id] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, params.limit);

    return topList;
  }

  async topSources(params: LatestNewsQueryParams): Promise<TopItem[]> {
    const rangeKey = buildDateRangeKey(params);

    const resultIds = await this.model.query({
      index: this.model.localeIndexName(),
      hashKey: DynamoNewsItemHelper.createLocaleKey(params),
      rangeKey,
      limit: 100,
      attributes: ["id"],
      order: "DESC"
    });

    if (!resultIds.items || !resultIds.items.length) {
      debug(`Top sources result ids is empty`, params);
      return [];
    }
    const ids = resultIds.items.map((item) => item.id);
    const newsItems = await this.model.getItems(
      ids.map((id) => ({ id })),
      { attributes: ["sourceId"] }
    );

    if (!newsItems.length) {
      debug(`Top sources news items by ids is empty`, ids);
      return [];
    }

    const topMap: Dictionary<number> = {};

    for (const item of newsItems) {
      const id = item.sourceId;
      if (!topMap[id]) {
        topMap[id] = 1;
      } else {
        topMap[id]++;
      }
    }

    const topList: TopItem[] = Object.keys(topMap)
      .map((id) => ({ id, count: topMap[id] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, params.limit);

    return topList;
  }

  protected async putTopicNews(
    locale: Locale,
    newsId: string,
    lastFoundAt: string,
    topics: Topic[],
    expiresAt: number
  ) {
    const items = TopicNewsHelper.create(
      locale,
      newsId,
      lastFoundAt,
      topics,
      expiresAt
    );

    for (const item of items) {
      await this.topicNewsModel.put(item);
    }
  }

  async deleteStorage(): Promise<void> {
    await Promise.all([
      this.topicNewsModel.deleteTable(),
      this.model.deleteTable()
    ]);
  }
  async createStorage(): Promise<void> {
    await Promise.all([
      this.searcher.init(),
      this.topicNewsModel.createTable(),
      this.model.createTable()
    ]);
  }
}
