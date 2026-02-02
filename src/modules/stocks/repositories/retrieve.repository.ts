import type { IDatabase, IPipeline } from '@point-hub/papi';

import type { IBroker } from '@/modules/master/brokers/interface';
import type { IIssuer } from '@/modules/master/issuers/interface';
import type { IOwner } from '@/modules/master/owners/interface';
import type { IAuthUser } from '@/modules/master/users/interface';

import { collectionName } from '../entity';
import type { IStock } from '../interface';

export interface IRetrieveRepository {
  handle(_id: string): Promise<IRetrieveOutput | null>
  raw(_id: string): Promise<IStock | null>
}

export interface IRetrieveOutput extends IStock {
  broker?: IBroker
  owner?: IOwner
  buying_list?: {
    uuid?: string
    issuer_id?: string
    ssuer?: IIssuer
    lots?: number
    shares?: number
    price?: number
    total?: number
  }[]
  selling_list?: {
    uuid?: string
    issuer_id?: string
    ssuer?: IIssuer
    lots?: number
    shares?: number
    price?: number
    total?: number
  }[]
  created_by?: IAuthUser
  updated_by?: IAuthUser
  archived_by?: IAuthUser
}

export class RetrieveRepository implements IRetrieveRepository {
  constructor(
    public database: IDatabase,
    public options?: Record<string, unknown>,
  ) { }

  async handle(_id: string): Promise<IRetrieveOutput | null> {
    const pipeline: IPipeline[] = [];

    pipeline.push(...this.pipeFilter(_id));
    pipeline.push(...this.pipeJoinCreatedById());
    pipeline.push(...this.pipeJoinOwnerId());
    pipeline.push(...this.pipeJoinBrokerId());
    pipeline.push(...this.pipeJoinBuyingListIssuer());
    pipeline.push(...this.pipeJoinSellingListIssuer());
    pipeline.push(...this.pipeProject());

    const response = await this.database.collection(collectionName).aggregate<IRetrieveOutput>(pipeline, {}, this.options);
    if (!response || response.data.length === 0) {
      return null;
    }

    return {
      _id: response.data[0]._id,
      form_number: response.data[0].form_number,
      transaction_date: response.data[0].transaction_date,
      settlement_date: response.data[0].settlement_date,
      broker_id: response.data[0].broker_id,
      broker: response.data[0].broker,
      transaction_number: response.data[0].transaction_number!,
      owner_id: response.data[0].owner_id,
      owner: response.data[0].owner,
      buying_list: response.data[0].buying_list,
      selling_list: response.data[0].selling_list,
      buying_total: response.data[0].buying_total,
      buying_brokerage_fee: response.data[0].buying_brokerage_fee,
      buying_vat: response.data[0].buying_vat,
      buying_levy: response.data[0].buying_levy,
      buying_kpei: response.data[0].buying_kpei,
      buying_stamp: response.data[0].buying_stamp,
      buying_proceed: response.data[0].buying_proceed,
      selling_total: response.data[0].selling_total,
      selling_brokerage_fee: response.data[0].selling_brokerage_fee,
      selling_vat: response.data[0].selling_vat,
      selling_levy: response.data[0].selling_levy,
      selling_kpei: response.data[0].selling_kpei,
      selling_stamp: response.data[0].selling_stamp,
      selling_proceed: response.data[0].selling_proceed,
      proceed_amount: response.data[0].proceed_amount,
      notes: response.data[0].notes,
      status: response.data[0].status,
      is_archived: response.data[0].is_archived,
    };
  }

  async raw(_id: string): Promise<IStock | null> {
    const response = await this.database.collection(collectionName).retrieve<IStock>(_id, this.options);
    if (!response) {
      return null;
    }

    return response;
  }

  private pipeFilter(_id: string): IPipeline[] {
    return [{ $match: { _id } }];
  }

  private pipeJoinCreatedById(): IPipeline[] {
    return [
      {
        $lookup: {
          from: 'users',
          let: { userId: '$created_by_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$userId'] } } },
            {
              $project: {
                _id: 1,
                name: 1,
                username: 1,
                email: 1,
              },
            },
          ],
          as: 'created_by',
        },
      },
      {
        $unwind: {
          path: '$created_by',
          preserveNullAndEmptyArrays: true,
        },
      },
    ];
  }

  private pipeJoinOwnerId(): IPipeline[] {
    return [
      {
        $lookup: {
          from: 'owners',
          let: { ownerId: '$owner_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$ownerId'] } } },
            {
              $project: {
                _id: 1,
                code: 1,
                name: 1,
              },
            },
          ],
          as: 'owner',
        },
      },
      {
        $unwind: {
          path: '$owner',
          preserveNullAndEmptyArrays: true,
        },
      },
    ];
  }

  private pipeJoinBrokerId(): IPipeline[] {
    return [
      {
        $lookup: {
          from: 'brokers',
          let: { brokerId: '$broker_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$brokerId'] } } },
            {
              $project: {
                _id: 1,
                code: 1,
                name: 1,
              },
            },
          ],
          as: 'broker',
        },
      },
      {
        $unwind: {
          path: '$broker',
          preserveNullAndEmptyArrays: true,
        },
      },
    ];
  }

  private pipeJoinBuyingListIssuer(): IPipeline[] {
    return [
      {
        $lookup: {
          from: 'issuers',
          localField: 'buying_list.issuer_id',
          foreignField: '_id',
          as: '__issuers_temp',
        },
      },
      {
        $set: {
          buying_list: {
            $map: {
              input: { $ifNull: ['$buying_list', []] },
              as: 'item',
              in: {
                $mergeObjects: [
                  '$$item',
                  {
                    issuer: {
                      $let: {
                        vars: {
                          issuerMatched: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: '$__issuers_temp',
                                  as: 'b',
                                  cond: { $eq: ['$$b._id', '$$item.issuer_id'] },
                                },
                              },
                              0,
                            ],
                          },
                        },
                        in: {
                          _id: '$$issuerMatched._id',
                          code: '$$issuerMatched.code',
                          name: '$$issuerMatched.name',
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      { $unset: '__issuers_temp' },
    ];
  }

  private pipeJoinSellingListIssuer(): IPipeline[] {
    return [
      {
        $lookup: {
          from: 'issuers',
          localField: 'selling_list.issuer_id',
          foreignField: '_id',
          as: '__issuers_temp',
        },
      },
      {
        $set: {
          selling_list: {
            $map: {
              input: { $ifNull: ['$selling_list', []] },
              as: 'item',
              in: {
                $mergeObjects: [
                  '$$item',
                  {
                    issuer: {
                      $let: {
                        vars: {
                          issuerMatched: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: '$__issuers_temp',
                                  as: 'b',
                                  cond: { $eq: ['$$b._id', '$$item.issuer_id'] },
                                },
                              },
                              0,
                            ],
                          },
                        },
                        in: {
                          _id: '$$issuerMatched._id',
                          code: '$$issuerMatched.code',
                          name: '$$issuerMatched.name',
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      { $unset: '__issuers_temp' },
    ];
  }

  private pipeProject(): IPipeline[] {
    return [
      {
        $project: {
          _id: 1,
          form_number: 1,
          transaction_date: 1,
          settlement_date: 1,
          broker_id: 1,
          broker: 1,
          owner_id: 1,
          owner: 1,
          transaction_number: 1,
          buying_list: 1,
          selling_list: 1,
          buying_total: 1,
          buying_brokerage_fee: 1,
          buying_vat: 1,
          buying_levy: 1,
          buying_kpei: 1,
          buying_stamp: 1,
          buying_proceed: 1,
          selling_total: 1,
          selling_brokerage_fee: 1,
          selling_vat: 1,
          selling_levy: 1,
          selling_kpei: 1,
          selling_stamp: 1,
          selling_proceed: 1,
          proceed_amount: 1,
          notes: 1,
          is_archived: 1,
          status: 1,
          created_at: 1,
          created_by_id: 1,
          created_by: 1,
          updated_at: 1,
          updated_by_id: 1,
          updated_by: 1,
          archived_at: 1,
          archived_by_id: 1,
          archived_by: 1,
        },
      },
    ];
  }
}
