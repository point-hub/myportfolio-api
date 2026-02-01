import { v7 } from '../services/uuid.service';
import { trimAllString } from '../utils/trim-all-string';

export abstract class BaseEntity<T> {
  protected normalize(input: T): T {
    return trimAllString(input);
  }

  protected ensureUUID<T extends { uuid?: string }>(
    items?: readonly T[],
  ): T[] | undefined {
    if (!items?.length) return items as T[] | undefined;

    return items.map(item => ({
      ...item,
      uuid: item.uuid ?? v7(),
    }));
  }
}