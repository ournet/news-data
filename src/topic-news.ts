import DynamoDB = require('aws-sdk/clients/dynamodb');
import {
    DynamoModel,
} from 'dynamo-model';
import { Topic } from '@ournet/news-domain';
import { DynamoNewsItemHelper } from './dynamo-news';
import { TOPIC_NEWS_ITEM_EXPIRE_DAYS } from './config';

export type TopicNewsKey = {
    topicId: string
    publishedAt: string
}

export interface TopicNews {
    topicId: string
    newsId: string
    publishedAt: string
    expiresAt: number
    locale: string
}

export class TopicNewsHelper {
    static create(country: string, lang: string, newsId: string, publishedAt: string, topics: Topic[]): TopicNews[] {
        const expiresAt = TopicNewsHelper.expiresAt(new Date(publishedAt));
        return topics.map(topic => {
            const item: TopicNews = {
                newsId,
                publishedAt,
                expiresAt,
                topicId: topic.id,
                locale: DynamoNewsItemHelper.createLocaleKey(country, lang),
            };

            return item;
        });
    }

    static expiresAt(date: Date) {
        date = new Date(date);
        date.setDate(date.getDate() + TOPIC_NEWS_ITEM_EXPIRE_DAYS);

        return Math.floor(date.getTime() / 1000);
    }
}

export class TopicNewsModel extends DynamoModel<TopicNewsKey, TopicNews> {
    localeLastTopicsIndexName() {
        return 'locale-last-topics-index';
    }
    topicLastNewsIndexName() {
        return 'topic-last-news-index';
    }

    constructor(client: DynamoDB.DocumentClient, tableSuffix: string) {
        super({
            hashKey: {
                name: 'topicId',
                type: 'S'
            },
            rangeKey: {
                name: 'newsId',
                type: 'S'
            },
            name: 'topic_news',
            tableName: `ournet_topic_news_${tableSuffix}`,
            indexes: [
                {
                    name: 'topic-last-news-index',
                    hashKey: {
                        name: 'topicId',
                        type: 'S'
                    },
                    rangeKey: {
                        name: 'publishedAt',
                        type: 'S'
                    },
                    type: 'LOCAL',
                    projection: {
                        type: 'KEYS_ONLY'
                    }
                },
                {
                    name: 'locale-last-topics-index',
                    hashKey: {
                        name: 'locale',
                        type: 'S'
                    },
                    rangeKey: {
                        name: 'publishedAt',
                        type: 'S'
                    },
                    type: 'GLOBAL',
                    projection: {
                        type: 'KEYS_ONLY'
                    }
                }
            ]
        }, client);
    }
}
