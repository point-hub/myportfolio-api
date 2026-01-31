import { BaseEntity } from '@/modules/_shared/entity/base.entity';

import { type IDeposit } from './interface';

export const collectionName = 'deposits';

export class DepositEntity extends BaseEntity<IDeposit> {
  constructor(public data: IDeposit) {
    super();

    this.data = this.normalize(this.data);
  }
}
