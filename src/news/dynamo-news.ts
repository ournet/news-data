import { NewsItem } from "@ournet/news-domain";

export interface DynamoNewsItem extends NewsItem {
    /** COUNTRY_LANG */
    locale: string
}

export class DynamoNewsItemHelper {

    static createLocaleKey(country: string, lang: string) {
        return `${country.toUpperCase()}_${lang.toUpperCase()}`;
    }

    static mapFromNews(data: NewsItem) {
        const item: DynamoNewsItem = {
            ...data, locale: DynamoNewsItemHelper.createLocaleKey(data.country, data.lang),
        };

        return item;
    }

    static mapToNews(item: DynamoNewsItem) {
        delete item.locale;

        const data = item as NewsItem;

        return data;
    }

    static mapFromPartialNews(data: Partial<NewsItem>) {
        const item: Partial<DynamoNewsItem> = { ...data };
        return item;
    }
}
