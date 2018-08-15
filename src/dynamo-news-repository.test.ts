
import test from 'ava';
import { launch, stop } from 'dynamodb-local';
import DynamoDB = require('aws-sdk/clients/dynamodb');
import { DynamoNewsRepository } from './dynamo-news-repository';
import { NewsRepository, NewsHelper } from '@ournet/news-domain';

test.before('start dynamo', async t => {
    await t.notThrows(launch(8000, null, ['-inMemory', '-sharedDb']));
})

test.after('top dynamo', async t => {
    t.notThrows(() => stop(8000));
})

const client = new DynamoDB.DocumentClient({
    region: "eu-central-1",
    endpoint: "http://localhost:8000",
    accessKeyId: 'ID',
    secretAccessKey: 'Key',
});

import { NewsSearcher } from './news-searcher';
NewsSearcher.prototype.init = () => new Promise(resolve => resolve());
NewsSearcher.prototype.index = () => new Promise(resolve => resolve());

const repository: NewsRepository = new DynamoNewsRepository(client, 'localhost', 'test');

test.skip('throw no table', async t => {
    await t.throws(repository.exists('id1'), /non-existent table/);
})

test.beforeEach('createStorage', async t => {
    await t.notThrows(repository.createStorage());
})

test.afterEach('deleteStorage', async t => {
    await t.notThrows(repository.deleteStorage());
})

test.serial('#create', async t => {
    const initialItem = NewsHelper.build({
        country: 'md',
        lang: 'ro',
        url: 'http://protv.md',
        title: 'Titlu stire',
        summary: `Stire importanta despre Romania, RM si Vlad Filat
        Stire importanta despre Romania, RM si Vlad Filat
        Stire importanta despre Romania, RM si Vlad Filat`,
        topics: [
            {
                id: 'qtopic1',
                name: 'Vlad Filat',
                slug: 'vlad-filat',
                type: 'PERSON'
            },
            {
                id: 'qtopic2',
                name: 'Republica Moldova',
                abbr: 'RM',
                type: 'PLACE',
                slug: 'moldova'
            },
            {
                id: 'qtopic3',
                name: 'Romania',
                slug: 'romania'
            }
        ],
        hasContent: false,
        sourceId: 'protv',
    });

    const createdItem = await repository.create(initialItem);
    t.is(createdItem.id, initialItem.id);
    t.deepEqual(createdItem, initialItem);
    t.deepEqual(createdItem.topics, initialItem.topics);

    await t.throws(repository.create(initialItem), /The conditional request failed/);
})

test.serial('#update', async t => {
    const initialItem = NewsHelper.build({
        country: 'md',
        lang: 'ro',
        url: 'https://protv.md',
        title: 'Titlu stire',
        summary: `Stire importanta despre Romania, RM si Vlad Filat
        Stire importanta despre Romania, RM si Vlad Filat
        Stire importanta despre Romania, RM si Vlad Filat`,
        topics: [
            {
                id: 'qtopic1',
                name: 'Vlad Filat',
                slug: 'vlad-filat',
                type: 'PERSON'
            },
            {
                id: 'qtopic2',
                name: 'Republica Moldova',
                abbr: 'RM',
                type: 'PLACE',
                slug: 'moldova'
            },
            {
                id: 'qtopic3',
                name: 'Romania',
                slug: 'romania'
            }
        ],
        hasContent: false,
        sourceId: 'protv',
    });

    const createdItem = await repository.create(initialItem);
    t.deepEqual(createdItem, initialItem);

    await t.throws(repository.update({ id: initialItem.id.replace(/1/g, '2'), set: {} }),
        /The conditional request failed/, 'no empty set');
    await t.throws(repository.update({ id: initialItem.id }),
        /"value" must contain at least one of \[set, delete\]/, 'set or delete are required');
    await t.throws(repository.update({ id: initialItem.id, set: { country: 'ru' } }),
        /"country" is not allowed/, 'country is not allowed');
    await t.throws(repository.update({ id: initialItem.id, set: { lang: 'ru' } }),
        /"lang" is not allowed/, 'lang is not allowed');
    await t.throws(repository.update({ id: initialItem.id, set: { summary: 'new text' } }),
        /"summary" is not allowed/, 'summary is not allowed');
    await t.throws(repository.update({ id: initialItem.id, set: { sourceId: 'newid' } }),
        /"sourceId" is not allowed/, 'sourceId is not allowed');

    const updatedItem = await repository.update({
        id: initialItem.id,
        set: {
            countViews: 1,
            updatedAt: new Date().toISOString(),
        }
    });

    t.is(updatedItem.countViews, 1);
    t.not(updatedItem.updatedAt, initialItem.updatedAt);
})

test.serial('#query', async t => {
    const country = 'md';
    const lang = 'ro';
    const initialItem1 = NewsHelper.build({
        country,
        lang,
        url: 'http://protv.md',
        title: 'Titlu stire',
        summary: `Stire importanta despre Romania, RM si Vlad Filat
        Stire importanta despre Romania, RM si Vlad Filat
        Stire importanta despre Romania, RM si Vlad Filat`,
        topics: [
            {
                id: 'qtopic1',
                name: 'Vlad Filat',
                slug: 'vlad-filat',
                type: 'PERSON'
            },
            {
                id: 'qtopic2',
                name: 'Republica Moldova',
                abbr: 'RM',
                type: 'PLACE',
                slug: 'moldova'
            },
            {
                id: 'qtopic3',
                name: 'Romania',
                slug: 'romania'
            }
        ],
        hasContent: false,
        sourceId: 'protv',
    });
    await new Promise(resolve => setTimeout(resolve, 100));
    const initialItem2 = NewsHelper.build({
        country,
        lang,
        url: 'http://protv.md/2',
        title: 'Titlu stire',
        summary: `Stire importanta despre Romania si RM
        Stire importanta despre Romania si RM
        Stire importanta despre Romania si RM`,
        topics: [
            {
                id: 'qtopic2',
                name: 'Republica Moldova',
                abbr: 'RM',
                type: 'PLACE',
                slug: 'moldova'
            },
            {
                id: 'qtopic3',
                name: 'Romania',
                slug: 'romania',
            }
        ],
        hasContent: true,
        sourceId: 'jurnalul',
    });

    const createdItem1 = await repository.create(initialItem1);
    t.deepEqual(createdItem1, initialItem1);
    const createdItem2 = await repository.create(initialItem2);
    t.deepEqual(createdItem2, createdItem2);

    const totalCount = await repository.count({ country, lang });
    t.is(totalCount, 2, '2 news in db');

    const countSource1 = await repository.countBySource({ country, lang, sourceId: initialItem1.sourceId });
    t.is(countSource1, 1, '1 news by source 1');
    const countSource2 = await repository.countBySource({ country, lang, sourceId: initialItem2.sourceId });
    t.is(countSource2, 1, '1 news by source 2');

    const countTopicFilat = await repository.countByTopic({ country, lang, topicId: 'qtopic1' });
    t.is(countTopicFilat, 1, '1 news by topic filat');

    const countTopicRomania = await repository.countByTopic({ country, lang, topicId: 'qtopic3' });
    t.is(countTopicRomania, 2, '2 news by topic Romania');

    const totalItems = await repository.latest({ country, lang, limit: 10 }, { fields: ['id', 'sourceId', 'publishedAt'] });
    t.is(totalItems.length, 2, '2 news in db');
    t.is(totalItems[0].id, initialItem2.id, 'news order DESC by publishedAt');
    t.deepEqual(Object.keys(totalItems[0]).length, 3, 'filter fields');

    const itemsBySource1 = await repository.latestBySource({ country, lang, sourceId: initialItem1.sourceId, limit: 10 });
    t.is(itemsBySource1.length, 1, '1 news by source 1');
    t.is(itemsBySource1[0].id, initialItem1.id, '1 news by source 1');

    const itemsSource2 = await repository.latestBySource({ country, lang, sourceId: initialItem2.sourceId, limit: 10 });
    t.is(itemsSource2.length, 1, '1 news by source 2');
    t.is(itemsSource2[0].id, initialItem2.id, '1 news by source 2');

    const itemsTopicFilat = await repository.latestByTopic({ country, lang, topicId: 'qtopic1', limit: 10 });
    t.is(itemsTopicFilat.length, 1, '1 news by topic filat');

    const itemsTopicRomania = await repository.latestByTopic({ country, lang, topicId: 'qtopic3', limit: 10 });
    t.is(itemsTopicRomania.length, 2, '2 news by topic Romania');
})

test.serial('#topSources', async t => {
    const country = 'md';
    const lang = 'ro';
    const newsItems = [NewsHelper.build({
        country,
        lang,
        url: 'https://protv.md/1',
        title: 'Titlu stire',
        summary: `Stire importanta 1
        Stire importanta despre Romania si RM
        Stire importanta despre Romania si RM
        Stire importanta despre Romania si RM`,
        hasContent: false,
        sourceId: 'source1',
        topics: [
            { id: 'topic1', slug: 'topic1', name: 'Topics1' }
        ],
    }), NewsHelper.build({
        country,
        lang,
        url: 'https://protv.md/2',
        title: 'Titlu stire',
        summary: `Stire importanta 2
        Stire importanta despre Romania si RM
        Stire importanta despre Romania si RM
        Stire importanta despre Romania si RM`,
        hasContent: false,
        sourceId: 'source2',
        topics: [
            { id: 'topic1', slug: 'topic1', name: 'Topics1' }
        ],
    }), NewsHelper.build({
        country,
        lang,
        url: 'https://protv.md/3',
        title: 'Titlu stire',
        summary: `Stire importanta 3
        Stire importanta despre Romania si RM
        Stire importanta despre Romania si RM
        Stire importanta despre Romania si RM`,
        hasContent: false,
        sourceId: 'source2',
        topics: [
            { id: 'topic1', slug: 'topic1', name: 'Topics1' }
        ],
    }), NewsHelper.build({
        country,
        lang,
        url: 'https://protv.md/4',
        title: 'Titlu stire',
        summary: `Stire importanta 4
        Stire importanta despre Romania si RM
        Stire importanta despre Romania si RM
        Stire importanta despre Romania si RM`,
        hasContent: false,
        sourceId: 'source3',
        topics: [
            { id: 'topic1', slug: 'topic1', name: 'Topics1' }
        ],
    }), NewsHelper.build({
        country,
        lang,
        url: 'https://protv.md/5',
        title: 'Titlu stire',
        summary: `Stire importanta 5
        Stire importanta despre Romania si RM
        Stire importanta despre Romania si RM
        Stire importanta despre Romania si RM`,
        hasContent: false,
        sourceId: 'source3',
        topics: [
            { id: 'topic1', slug: 'topic1', name: 'Topics1' }
        ],
    }), NewsHelper.build({
        country,
        lang,
        url: 'https://protv.md/6',
        title: 'Titlu stire',
        summary: `Stire importanta 6
        Stire importanta despre Romania si RM
        Stire importanta despre Romania si RM
        Stire importanta despre Romania si RM`,
        hasContent: false,
        sourceId: 'source3',
        topics: [
            { id: 'topic1', slug: 'topic1', name: 'Topics1' }
        ],
    })];

    for (const item of newsItems) {
        await repository.create(item);
    }

    const topSources = await repository.topSources({ country, lang, limit: 10 });

    t.is(topSources.length, 3);
    t.deepEqual(topSources[0], { id: 'source3', count: 3 });
    t.deepEqual(topSources[1], { id: 'source2', count: 2 });
    t.deepEqual(topSources[2], { id: 'source1', count: 1 });
})

test.serial('#topSourceTopics', async t => {
    const country = 'md';
    const lang = 'ro';
    const newsItems = [NewsHelper.build({
        country,
        lang,
        url: 'https://protv.md/1',
        title: 'Titlu stire',
        summary: `Stire importanta 1
        Stire importanta despre Romania si RM
        Stire importanta despre Romania si RM
        Stire importanta despre Romania si RM`,
        hasContent: false,
        sourceId: 'source1',
        topics: [
            { id: 'topic1', name: 'Topic1', slug: 'topic1' },
        ],
    }), NewsHelper.build({
        country,
        lang,
        url: 'https://protv.md/2',
        title: 'Titlu stire',
        summary: `Stire importanta 2
        Stire importanta despre Romania si RM
        Stire importanta despre Romania si RM
        Stire importanta despre Romania si RM`,
        hasContent: false,
        sourceId: 'source1',
        topics: [
            { id: 'topic1', name: 'Topic1', slug: 'topic1' },
            { id: 'topic2', name: 'Topic2', slug: 'topic2' },
        ],
    }), NewsHelper.build({
        country,
        lang,
        url: 'https://protv.md/3',
        title: 'Titlu stire',
        summary: `Stire importanta 6
        Stire importanta despre Romania si RM
        Stire importanta despre Romania si RM
        Stire importanta despre Romania si RM`,
        hasContent: false,
        sourceId: 'source3',
        topics: [
            { id: 'topic1', name: 'Topic1', slug: 'topic1' },
            { id: 'topic2', name: 'Topic2', slug: 'topic2' },
            { id: 'topic3', name: 'Topic3', slug: 'topic3' },
        ],
    })];

    for (const item of newsItems) {
        await repository.create(item);
    }

    const topSources = await repository.topSourceTopics({ country, lang, limit: 10, sourceId: 'source1' });

    t.is(topSources.length, 2);
    t.deepEqual(topSources[0], { id: 'topic1', count: 2 });
    t.deepEqual(topSources[1], { id: 'topic2', count: 1 });
})
