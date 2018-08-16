import { BaseEntity, BaseEntityId } from "@ournet/domain";
import { DynamoQueryRangeKey } from "dynamo-model";

export function sortEntitiesByIds<T extends BaseEntity>(ids: BaseEntityId[], entities: T[]) {
    const list: T[] = [];
    for (const id of ids) {
        const entity = entities.find(item => item.id === id);
        if (entity) {
            list.push(entity);
        }
    }

    return list;
}

export function buildDateRangeKey(params: { minDate?: string, maxDate?: string }) {
    let rangeKey: DynamoQueryRangeKey | undefined;
    if (params.maxDate && params.minDate) {
        rangeKey = {
            operation: 'BETWEEN',
            value: [params.minDate, params.maxDate]
        };
    } else if (params.maxDate) {
        rangeKey = {
            operation: '<',
            value: params.maxDate
        };
    } else if (params.minDate) {
        rangeKey = {
            operation: '>',
            value: params.minDate
        };
    }

    return rangeKey;
}
