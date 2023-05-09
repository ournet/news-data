import { Client, SearchResponse } from "elasticsearch";
import { NewsSearchParams, NewsItem } from "@ournet/news-domain";
import { atonic, Dictionary } from "@ournet/domain";

const mappings = require("../../elasticsearch_mappings.json");

const ES_NEWS_INDEX = "news";
const ES_NEWS_TYPE = "news_item";

export type NewsSearchItem = {
  id: string;
  score: number;
};

type SearchItem = {
  id: string;
  lang: string;
  country: string;
  publishedAt: string;
  [key: string]: string;
};

export class NewsSearcher {
  private client: Client;
  constructor(host: string | Record<string, any>) {
    const options =
      typeof host === "string"
        ? { host, ssl: { rejectUnauthorized: false, pfx: [] } }
        : host;
    this.client = new Client(options);
  }

  async search(params: NewsSearchParams): Promise<NewsSearchItem[]> {
    const q = atonic(params.q);
    const body: Dictionary<any> = {
      query: {
        filtered: {
          filter: {
            bool: {
              must: [
                {
                  term: {
                    country: params.country
                  }
                },
                {
                  term: {
                    lang: params.lang
                  }
                }
              ]
            }
          },
          query: {
            multi_match: {
              query: q,
              fields: ["title_" + params.lang, "summary_" + params.lang]
            }
          }
        }
      }
    };
    if (params.minScore) {
      body.min_score = params.minScore;
    }
    // if (params.ignoreId) {
    //   body.query.filtered.filter.not = {
    //     _id: params.ignoreId
    //   };
    // }

    const response = await this.client.search<SearchItem>({
      index: ES_NEWS_INDEX,
      type: ES_NEWS_TYPE,
      body: body
    });

    return parseResponse(response);
  }

  async index(data: NewsItem, refresh?: "true" | "false" | "wait_for") {
    const item = normalizeItem(data);

    await this.client.index<SearchItem>({
      index: ES_NEWS_INDEX,
      type: ES_NEWS_TYPE,
      id: item.id,
      body: item,
      ttl: "24h",
      refresh
    });
  }

  async update(data: NewsItem, refresh?: "true" | "false" | "wait_for") {
    const item = normalizeItem(data);

    await this.client.update({
      index: ES_NEWS_INDEX,
      type: ES_NEWS_TYPE,
      id: item.id,
      body: item,
      refresh
    });
  }

  async refresh() {
    await this.refresh();
  }

  async init() {
    const exists = await this.client.indices.exists({
      index: ES_NEWS_INDEX
    });

    if (exists) {
      return;
    }

    await this.client.indices.create({
      index: ES_NEWS_INDEX
    });
    await this.client.indices.putMapping({
      index: ES_NEWS_INDEX,
      type: ES_NEWS_TYPE,
      body: mappings
    });
  }
}

function parseResponse(response: SearchResponse<SearchItem>): NewsSearchItem[] {
  if (!response.hits || !response.hits.total) {
    return [];
  }

  return response.hits.hits.map((item) => ({
    id: item._source.id,
    score: item._score
  }));
}

function normalizeItem(data: NewsItem) {
  const id = data.id;
  const item: SearchItem = {
    id,
    country: data.country,
    lang: data.lang,
    publishedAt: data.publishedAt
  };

  item["title_" + item.lang] = atonic(data.title);
  item["summary_" + item.lang] = atonic(data.summary.substr(0, 200));

  return item;
}
