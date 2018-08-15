import DynamoDB = require('aws-sdk/clients/dynamodb');
import {
    DynamoModel,
} from 'dynamo-model';

import { DynamoNewsItem } from './dynamo-news';

export type NewsItemKey = {
    id: string
}

export class NewsItemModel extends DynamoModel<NewsItemKey, DynamoNewsItem> {
    localeIndexName() {
        return 'locale-index';
    }
    sourceIndexName() {
        return 'source-index';
    }
    eventIndexName() {
        return 'event-index';
    }
    constructor(client: DynamoDB.DocumentClient, tableSuffix: string) {
        super({
            hashKey: {
                name: 'id',
                type: 'S'
            },
            name: 'news',
            tableName: `ournet_news_${tableSuffix}`,
            indexes: [
                {
                    name: 'source-index',
                    hashKey: {
                        name: 'sourceId',
                        type: 'S'
                    },
                    rangeKey: {
                        name: 'publishedAt',
                        type: 'S'
                    },
                    type: 'GLOBAL',
                    projection: {
                        type: 'KEYS_ONLY',
                    }
                },
                {
                    name: 'event-index',
                    hashKey: {
                        name: 'eventId',
                        type: 'S'
                    },
                    rangeKey: {
                        name: 'publishedAt',
                        type: 'S'
                    },
                    type: 'GLOBAL',
                    projection: {
                        type: 'KEYS_ONLY',
                    }
                },
                {
                    name: 'locale-index',
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
                        type: 'KEYS_ONLY',
                    }
                }
            ]
        }, client);
    }
}
