import DynamoDB = require('aws-sdk/clients/dynamodb');
import { DynamoModel } from "dynamo-model";
import { ArticleContent } from "@ournet/news-domain";

export type ArticleContentKey = {
    id: string
}

export class ArticleContentModel extends DynamoModel<ArticleContentKey, ArticleContent> {
    constructor(client: DynamoDB.DocumentClient, tableSuffix: string) {
        super({
            hashKey: {
                name: 'id',
                type: 'S'
            },
            name: 'articles_content',
            tableName: `ournet_articles_content_${tableSuffix}`,
        }, client);
    }
}
