import DynamoDB = require('aws-sdk/clients/dynamodb');
import { NewsRepository, EventRepository } from '@ournet/news-domain';
import { DynamoNewsRepository } from './news/dynamo-news-repository';
import { DynamoEventRepository } from './events/dynamo-event-repository';


export class RepositoryBuilder {
    static buildNewsRepository(client: DynamoDB.DocumentClient, esHost: string, tableSuffix: string = 'v0'): NewsRepository {
        return new DynamoNewsRepository(client, esHost, tableSuffix);
    }

    static buildEventsRepository(client: DynamoDB.DocumentClient, tableSuffix: string = 'v0'): EventRepository {
        return new DynamoEventRepository(client, tableSuffix);
    }
}
