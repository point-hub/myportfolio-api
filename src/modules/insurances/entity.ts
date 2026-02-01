import { BaseEntity } from '@/modules/_shared/entity/base.entity';

import { type IInsurance } from './interface';

export const collectionName = 'insurances';

export class InsuranceEntity extends BaseEntity<IInsurance> {
  constructor(public data: IInsurance) {
    super();

    this.data = this.normalize(this.data);
    this.data.interest_schedule = this.ensureUUID(this.data.interest_schedule);
    this.data.cashback_schedule = this.ensureUUID(this.data.cashback_schedule);
  }
}
