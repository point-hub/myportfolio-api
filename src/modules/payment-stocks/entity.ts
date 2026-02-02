import { BaseEntity } from '@/modules/_shared/entity/base.entity';

import { type IPaymentStock } from './interface';

export const collectionName = 'payment_stocks';

export class PaymentStockEntity extends BaseEntity<IPaymentStock> {
  constructor(public data: IPaymentStock) {
    super();

    this.data = this.normalize(this.data);
    this.data.transactions = this.ensureUUID(this.data.transactions);
  }
}
