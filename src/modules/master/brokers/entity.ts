import { BaseEntity } from '@/modules/_shared/entity/base.entity';

import { type IBroker } from './interface';

export const collectionName = 'brokers';

export class BrokerEntity extends BaseEntity<IBroker> {
  constructor(public data: IBroker) {
    super();

    this.data = this.normalize(this.data);
  }
}
