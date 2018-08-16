import DynamoDB = require('aws-sdk/clients/dynamodb');
import { DynamoModel } from "dynamo-model";
import { NewsEvent } from "@ournet/news-domain";
import { DynamoEventHelper } from "./dynamo-event";
import { LATEST_EVENT_EXPIRE_DAYS } from "../config";
import { Locale } from "../common";

export interface DynamoLatestEvent {
    eventId: string
    locale: string

    createdAt: string
    expiresAt: number
}

export class DynamoLatestEventHelper {
    static mapFromEvent(data: NewsEvent) {
        const item: DynamoLatestEvent = {
            eventId: data.id,
            createdAt: data.createdAt,
            expiresAt: DynamoLatestEventHelper.expiresAt(new Date(data.createdAt)),
            locale: DynamoLatestEventHelper.createLocaleKey(data),
        };

        return item;
    }

    static createLocaleKey(locale: Locale){
        return DynamoEventHelper.createLocaleKey(locale);
    }

    static expiresAt(date: Date) {
        date = new Date(date);
        date.setDate(date.getDate() + LATEST_EVENT_EXPIRE_DAYS);

        return Math.floor(date.getTime() / 1000);
    }
}

export type LatestEventKey = {
    eventId: string
}

export class LatestEventModel extends DynamoModel<LatestEventKey, DynamoLatestEvent> {
    constructor(client: DynamoDB.DocumentClient, tableSuffix: string) {
        super({
            hashKey: {
                name: 'locale',
                type: 'S'
            },
            rangeKey: {
                name: 'createdAt',
                type: 'S'
            },
            name: 'latest_events',
            tableName: `ournet_latest_events_${tableSuffix}`,
        }, client);
    }
}
