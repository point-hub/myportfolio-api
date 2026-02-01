import { BaseEntity } from '@/modules/_shared/entity/base.entity';

import { type ISaving } from './interface';

export const collectionName = 'savings';

export class SavingEntity extends BaseEntity<ISaving> {
  constructor(public data: ISaving) {
    super();

    this.data = this.normalize(this.data);
  }
}
