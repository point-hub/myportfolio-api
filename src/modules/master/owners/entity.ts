import { BaseEntity } from '@/modules/_shared/entity/base.entity';

import { type IOwner } from './interface';

export const collectionName = 'owners';

export class OwnerEntity extends BaseEntity<IOwner> {
  constructor(public data: IOwner) {
    super();

    this.data = this.normalize(this.data);
  }
}
