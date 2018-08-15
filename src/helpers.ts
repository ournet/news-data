import { BaseEntity, BaseEntityId } from "@ournet/domain";

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
