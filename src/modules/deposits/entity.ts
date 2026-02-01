import { BaseEntity } from '@/modules/_shared/entity/base.entity';

import { type IDeposit } from './interface';

export const collectionName = 'deposits';

export class DepositEntity extends BaseEntity<IDeposit> {
  constructor(public data: IDeposit) {
    super();

    this.data = this.normalize(this.data);
    this.data.interest_schedule = this.ensureUUID(this.data.interest_schedule);
    this.data.cashback_schedule = this.ensureUUID(this.data.cashback_schedule);
  }
}
