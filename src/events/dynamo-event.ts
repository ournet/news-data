import { NewsEvent, EventHelper } from "@ournet/news-domain";

export interface DynamoEvent extends NewsEvent {
    /** COUNTRY_LANG */
    locale: string
}

export class DynamoEventHelper {
    static createLocaleFromId(eventId: string) {
        const item = EventHelper.parseLocaleFromId(eventId);
        const locale = DynamoEventHelper.createLocaleKey(item.country, item.lang);

        return locale;
    }

    static createLocaleKey(country: string, lang: string) {
        return `${country.toUpperCase()}_${lang.toUpperCase()}`;
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
