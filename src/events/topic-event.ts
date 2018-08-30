import DynamoDB = require('aws-sdk/clients/dynamodb');
import {
    DynamoModel,
} from 'dynamo-model';
import { Topic } from '@ournet/news-domain';
import { DynamoEventHelper } from './dynamo-event';
import { TOPIC_NEWS_EVENT_EXPIRE_DAYS } from '../config';
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
        const expiresAt = TopicEventHelper.expiresAt(new Date(createdAt));
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

    static expiresAt(date: Date) {
        date = new Date(date);
        date.setDate(date.getDate() + TOPIC_NEWS_EVENT_EXPIRE_DAYS);

        return Math.floor(date.getTime() / 1000);
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
