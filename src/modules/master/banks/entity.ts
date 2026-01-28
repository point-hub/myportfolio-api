import { BaseEntity } from '@/modules/_shared/entity/base.entity';

import { type IBank } from './interface';

export const collectionName = 'banks';

export class BankEntity extends BaseEntity<IBank> {
  constructor(public data: IBank) {
    super();

    this.data = this.normalize(this.data);
  }
}
