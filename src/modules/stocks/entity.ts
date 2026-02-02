import { BaseEntity } from '@/modules/_shared/entity/base.entity';

import { type IStock } from './interface';

export const collectionName = 'stocks';

export class StockEntity extends BaseEntity<IStock> {
  constructor(public data: IStock) {
    super();

    this.data = this.normalize(this.data);
    this.data.buying_list = this.ensureUUID(this.data.buying_list);
    this.data.selling_list = this.ensureUUID(this.data.selling_list);
  }
}
