import { BaseEntity } from '@/modules/_shared/entity/base.entity';

import { type IBond } from './interface';

export const collectionName = 'bonds';

export class BondEntity extends BaseEntity<IBond> {
  constructor(public data: IBond) {
    super();

    this.data = this.normalize(this.data);
    this.data.received_coupons = this.ensureUUID(this.data.received_coupons);
  }
}
