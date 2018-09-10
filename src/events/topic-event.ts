import DynamoDB = require('aws-sdk/clients/dynamodb');
import {
    DynamoModel,
} from 'dynamo-model';
import { Topic, EventHelper } from '@ournet/news-domain';
import { DynamoEventHelper } from './dynamo-event';
import { Locale } from '../common';

export type TopicEventKey = {
    topicId: string
    createdAt: string
}

export interface TopicEvent {
    topicId: string
    eventId: string
    createdAt: string
    expiresAt: number
    locale: string
}

export class TopicEventHelper {
    static create(locale: Locale, eventId: string, createdAt: string, topics: Topic[]): TopicEvent[] {
        const expiresAt = EventHelper.topicExpiresAt(new Date(createdAt));
        return topics.map(topic => {
            const item: TopicEvent = {
                eventId,
                createdAt,
                expiresAt,
                topicId: topic.id,
                locale: DynamoEventHelper.createLocaleKey(locale),
            };

            return item;
        });
    }
}

export class TopicEventModel extends DynamoModel<TopicEventKey, TopicEvent> {
    localeLastTopicsIndexName() {
        return 'locale-last-topics-index';
    }
    topicLastEventsIndexName() {
        return 'topic-last-events-index';
    }

    constructor(client: DynamoDB.DocumentClient, tableSuffix: string) {
        super({
            hashKey: {
                name: 'topicId',
                type: 'S'
            },
            rangeKey: {
                name: 'eventId',
                type: 'S'
            },
            name: 'topic_events',
            tableName: `ournet_events__topic_${tableSuffix}`,
            indexes: [
                {
                    name: 'topic-last-events-index',
                    hashKey: {
                        name: 'topicId',
                        type: 'S'
                    },
                    rangeKey: {
                        name: 'createdAt',
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
                        name: 'createdAt',
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
