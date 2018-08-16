
// const debug = require('debug')('ournet:news-data');

import DynamoDB = require('aws-sdk/clients/dynamodb');
import {
    BaseRepository,
    RepositoryUpdateData,
    RepositoryAccessOptions,
} from '@ournet/domain';

import {
    ArticleContent,
    ArticleContentValidator,
    ArticleContentRepository,
} from '@ournet/news-domain';

import { ArticleContentModel } from './dynamo-article-content';

export class DynamoArticleContentRepository extends BaseRepository<ArticleContent> implements ArticleContentRepository {
    protected model: ArticleContentModel

    constructor(client: DynamoDB.DocumentClient, tableSuffix: string) {
        super(new ArticleContentValidator());
        this.model = new ArticleContentModel(client, tableSuffix);
    }

    async innerCreate(data: ArticleContent) {
        return await this.model.create(data);
    }

    async innerUpdate(data: RepositoryUpdateData<ArticleContent>) {
        return await this.model.update({
            remove: data.delete,
            key: { id: data.id },
            set: data.set,
        });
    }

    async delete(id: string) {
        const oldItem = await this.model.delete({ id });
        return !!oldItem;
    }

    async exists(id: string) {
        const item = await this.getById(id, { fields: ['id'] });

        return !!item;
    }

    async getById(id: string, options?: RepositoryAccessOptions<ArticleContent>) {
        return await this.model.get({ id }, options && { attributes: options.fields });
    }

    async getByIds(ids: string[], options?: RepositoryAccessOptions<ArticleContent>) {
        return await this.model.getItems(ids.map(id => ({ id })), options && { attributes: options.fields });
    }

    async deleteStorage(): Promise<void> {
        await Promise.all([
            this.model.deleteTable(),
        ]);
    }
    async createStorage(): Promise<void> {
        await Promise.all([
            this.model.createTable(),
        ]);
    }
}
