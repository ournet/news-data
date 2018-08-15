import DynamoDB = require('aws-sdk/clients/dynamodb');
import { NewsRepository } from '@ournet/news-domain';
import { DynamoNewsRepository } from './dynamo-news-repository';


export class RepositoryBuilder {
    static buildNewsRepository(client: DynamoDB.DocumentClient, esHost: string, tableSuffix: string = 'v0'): NewsRepository {
        return new DynamoNewsRepository(client, esHost, tableSuffix);
    }
}
