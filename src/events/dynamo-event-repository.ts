
const debug = require('debug')('ournet:news-data');

import DynamoDB = require('aws-sdk/clients/dynamodb');
import {
    BaseRepository,
    RepositoryUpdateData,
    RepositoryAccessOptions,
    Dictionary,
    mapPromise,
    uniq,
} from '@ournet/domain';

import {
    Topic,
    EventValidator,
    NewsEvent,
    EventRepository,
    LatestEventsQueryParams,
    LatestEventsByTopicQueryParams,
    CountEventsQueryParams,
    CountEventsByTopicQueryParams,
    TopItem,
    TrendingTopicsQueryParams,
    SimilarEventsByTopicsQueryParams,
} from '@ournet/news-domain';

import { DynamoEventHelper, EventModel } from './dynamo-event';
import { TopicEventModel, TopicEventHelper } from './topic-event';
import { sortEntitiesByIds, buildDateRangeKey } from '../helpers';
import { Locale } from '../common';
import { LatestEventModel, DynamoLatestEventHelper } from './dynamo-latest-event';
import ms = require('ms');

export class DynamoEventRepository extends BaseRepository<NewsEvent> implements EventRepository {
    protected model: EventModel
    protected latestModel: LatestEventModel
    protected topicModel: TopicEventModel

    constructor(client: DynamoDB.DocumentClient, tableSuffix: string) {
        super(new EventValidator());
        this.model = new EventModel(client, tableSuffix);
        this.latestModel = new LatestEventModel(client, tableSuffix);
        this.topicModel = new TopicEventModel(client, tableSuffix);
    }

    async similarByTopics(params: SimilarEventsByTopicsQueryParams, options?: RepositoryAccessOptions<NewsEvent>) {
        const index = this.topicModel.topicLastEventsIndexName();
        const rangeKey = buildDateRangeKey(params);

        const latestResults = await mapPromise(params.topicIds, topicId => this.topicModel.query({
            index,
            attributes: ['eventId'],
            hashKey: topicId,
            limit: params.limit,
            rangeKey,
            order: 'DESC',
        }));

        let allEventIds: string[] = [];

        for (const eventIds of latestResults.values()) {
            allEventIds = allEventIds.concat((eventIds.items || []).map(item => item.eventId));
        }

        if (allEventIds.length === 0) {
            return [];
        }

        const idsMap = allEventIds.reduce<Dictionary<number>>((dic, id) => {
            if (!dic[id]) {
                dic[id] = 0;
            }
            dic[id]++;
            return dic;
        }, {});

        if (params.exceptId) {
            delete idsMap[params.exceptId];
        }

        debug(`Similar events ids map: ${idsMap}`);

        const ids = uniq(
            Object.keys(idsMap)
                .map(id => ({ id, count: idsMap[id] }))
                .sort((a, b) => b.count - a.count)
                .map(item => item.id)
        ).slice(0, params.limit);

        if (ids.length === 0) {
            return [];
        }

        debug(`Similar events ids: ${ids}`);

        return this.getByIds(ids, options);
    }

    async viewNewsEvent(id: string) {
        const item = await this.model.get({ id }, { attributes: ['id', 'countViews'] });

        if (!item) {
            throw new Error(`Not found event id=${id}`);
        }

        const countViews = item.countViews + 1;

        await this.update({ id, set: { countViews } });

        return countViews;
    }

    async innerCreate(data: NewsEvent) {
        const createdItem = await this.model.create(DynamoEventHelper.mapFromEvent(data));

        const item = DynamoEventHelper.mapToEvent(createdItem);

        await this.latestModel.create(DynamoLatestEventHelper.mapFromEvent(item));

        if (item.topics) {
            await this.putTopicEvent(item, item.id, item.createdAt, item.topics);
        }

        return item;
    }

    async innerUpdate(data: RepositoryUpdateData<NewsEvent>) {
        const updatedItem = await this.model.update({
            remove: data.delete,
            key: { id: data.id },
            set: data.set && DynamoEventHelper.mapFromPartialEvent(data.set)
        });

        const item = DynamoEventHelper.mapToEvent(updatedItem);

        if (item.topics && item.topics.length && data.set && data.set.createdAt) {
            await this.putTopicEvent(item, item.id, item.createdAt, item.topics);
        }

        return item;
    }

    async delete(id: string) {
        const oldItem = await this.model.delete({ id });
        return !!oldItem;
    }

    async exists(id: string) {
        const item = await this.getById(id, { fields: ['id'] });

        return !!item;
    }

    async getById(id: string, options?: RepositoryAccessOptions<NewsEvent>) {
        const item = await this.model.get({ id }, options && { attributes: options.fields });

        if (!item) {
            return item;
        }

        return DynamoEventHelper.mapToEvent(item);
    }

    async getByIds(ids: string[], options?: RepositoryAccessOptions<NewsEvent>) {
        const items = await this.model.getItems(ids.map(id => ({ id })), options && { attributes: options.fields });

        const list = items.map(item => DynamoEventHelper.mapToEvent(item));

        return sortEntitiesByIds(ids, list);
    }

    async latest(params: LatestEventsQueryParams, options?: RepositoryAccessOptions<NewsEvent>) {
        const localeKey = DynamoEventHelper.createLocaleKey(params);
        const rangeKey = buildDateRangeKey(params);

        const latestResults = await this.latestModel.query({
            attributes: ['eventId'],
            hashKey: localeKey,
            limit: params.limit,
            rangeKey,
            order: 'DESC',
        });

        if (!latestResults.items || latestResults.items.length === 0) {
            return [];
        }

        const ids = latestResults.items.map(item => item.eventId);

        return this.getByIds(ids, options);
    }

    async latestByTopic(params: LatestEventsByTopicQueryParams, options?: RepositoryAccessOptions<NewsEvent>) {
        const index = this.topicModel.topicLastEventsIndexName();
        const hashKey = params.topicId;
        const rangeKey = buildDateRangeKey(params);

        const result = await this.topicModel.query({
            index,
            hashKey,
            limit: params.limit,
            rangeKey,
            order: 'DESC',
            attributes: ['eventId'],
        });

        if (!result.items || result.items.length === 0) {
            return [];
        }

        const ids = result.items.map(item => item.eventId);

        return this.getByIds(ids, options);
    }

    async count(params: CountEventsQueryParams) {
        const localeKey = DynamoLatestEventHelper.createLocaleKey(params);
        const rangeKey = buildDateRangeKey(params);

        const result = await this.latestModel.query({
            select: 'COUNT',
            hashKey: localeKey,
            rangeKey,
        });

        return result.count;
    }

    async countByTopic(params: CountEventsByTopicQueryParams) {
        const index = this.topicModel.topicLastEventsIndexName();
        const hashKey = params.topicId;
        const rangeKey = buildDateRangeKey(params);

        const result = await this.topicModel.query({
            index,
            select: 'COUNT',
            hashKey,
            rangeKey,
        });

        return result.count;
    }

    async topTopics(params: LatestEventsQueryParams): Promise<TopItem[]> {
        const latestEvents = await this.latest({ ...params, limit: 50 }, { fields: ['id', 'topics'] });

        if (!latestEvents.length) {
            return [];
        }

        const topMap: Dictionary<number> = {};

        for (const item of latestEvents) {
            if (item.topics && item.topics.length) {
                for (const topic of item.topics) {
                    const id = topic.id;
                    if (!topMap[id]) {
                        topMap[id] = 1;
                    } else {
                        topMap[id]++;
                    }
                }
            }
        }

        const topList: TopItem[] = Object.keys(topMap)
            .map(id => ({ id, count: topMap[id] }))
            .sort((a, b) => b.count - a.count)
            .slice(0, params.limit);

        return topList;
    }

    async trendingTopics(params: TrendingTopicsQueryParams): Promise<TopItem[]> {
        const now = Date.now();
        const midDate = new Date(now + ms(params.period)).toISOString().substr(0, 13);
        const endDate = new Date(now + (ms(params.period) * 2)).toISOString().substr(0, 13);

        const topTopics = await Promise.all([
            this.topTopics({
                country: params.country,
                lang: params.lang,
                limit: 100,
                minDate: midDate,
                maxDate: endDate,
            }),
            this.topTopics({
                country: params.country,
                lang: params.lang,
                limit: 100,
                maxDate: midDate,
            })
        ]);

        const firstLentgh = topTopics[0].length;
        const allTopTopics = topTopics[0].concat(topTopics[1]);

        const topMap: Dictionary<number> = {};

        allTopTopics.forEach((item, i) => {
            const id = item.id;
            if (i < firstLentgh) {
                topMap[id] = item.count * -1;
            } else {
                if (topMap[id] === undefined) {
                    topMap[id] = item.count;
                } else {
                    topMap[id] += item.count;
                }
            }
        });

        const topList: TopItem[] = Object.keys(topMap)
            .map(id => ({ id, count: topMap[id] }))
            .sort((a, b) => b.count - a.count)
            .slice(0, params.limit);

        return topList;
    }

    protected async putTopicEvent(locale: Locale, eventId: string, createdAt: string, topics: Topic[]) {
        const items = TopicEventHelper.create(locale, eventId, createdAt, topics);

        for (const item of items) {
            await this.topicModel.put(item);
        }
    }

    async deleteStorage(): Promise<void> {
        await Promise.all([
            this.latestModel.deleteTable(),
            this.model.deleteTable(),
            this.topicModel.deleteTable(),
        ]);
    }
    async createStorage(): Promise<void> {
        await Promise.all([
            this.latestModel.createTable(),
            this.model.createTable(),
            this.topicModel.createTable(),
        ]);
    }
}
