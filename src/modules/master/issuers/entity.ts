import { BaseEntity } from '@/modules/_shared/entity/base.entity';

import { type IIssuer } from './interface';

export const collectionName = 'issuers';

export class IssuerEntity extends BaseEntity<IIssuer> {
  constructor(public data: IIssuer) {
    super();

    this.data = this.normalize(this.data);
  }
}
