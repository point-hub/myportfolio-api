import { BaseEntity } from '@/modules/_shared/entity/base.entity';

import { type IDividendStock } from './interface';

export const collectionName = 'dividend_stocks';

export class DividendStockEntity extends BaseEntity<IDividendStock> {
  constructor(public data: IDividendStock) {
    super();

    this.data = this.normalize(this.data);
    this.data.transactions = this.ensureUUID(this.data.transactions);
  }
}
