import DynamoDB = require('aws-sdk/clients/dynamodb');
import { DynamoItem } from "dynamo-item";
import { NewsEvent, EventHelper } from "@ournet/news-domain";
import { Locale } from "../common";

export interface DynamoEvent extends NewsEvent {
    /** COUNTRY_LANG */
    locale: string
}

export class DynamoEventHelper {
    static createLocaleFromId(eventId: string) {
        const item = EventHelper.parseLocaleFromId(eventId);
        const locale = DynamoEventHelper.createLocaleKey(item);

        return locale;
    }

    static createLocaleKey(locale: Locale) {
        return `${locale.country.toUpperCase()}_${locale.lang.toUpperCase()}`;
    }

    static mapFromEvent(data: NewsEvent) {
        const item: DynamoEvent = {
            ...data, locale: DynamoEventHelper.createLocaleFromId(data.id),
        };

        return item;
    }

    static mapToEvent(item: DynamoEvent) {
        delete item.locale;

        const data = item as NewsEvent;

        return data;
    }

    static mapFromPartialEvent(data: Partial<NewsEvent>) {
        const item: Partial<DynamoEvent> = { ...data };
        return item;
    }
}

export type EventKey = {
    id: string
}

export class EventModel extends DynamoItem<EventKey, DynamoEvent> {
    constructor(client: DynamoDB.DocumentClient, tableSuffix: string) {
        super({
            hashKey: {
                name: 'id',
                type: 'S'
            },
            name: 'events',
            tableName: `ournet_events_${tableSuffix}`,
        }, client as any);
    }
}
