import DynamoDB = require('aws-sdk/clients/dynamodb');
import {
    DynamoItem,
} from 'dynamo-item';
import { Topic } from '@ournet/news-domain';
import { DynamoNewsItemHelper } from './dynamo-news';
import { Locale } from '../common';

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
    static create(locale: Locale, newsId: string, publishedAt: string, topics: Topic[], expiresAt: number): TopicNews[] {
        return topics.map(topic => {
            const item: TopicNews = {
                newsId,
                publishedAt,
                expiresAt,
                topicId: topic.id,
                locale: DynamoNewsItemHelper.createLocaleKey(locale),
            };

            return item;
        });
    }
}

export class TopicNewsModel extends DynamoItem<TopicNewsKey, TopicNews> {
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
            tableName: `ournet_news__topic_${tableSuffix}`,
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
        }, client as any);
    }
}
