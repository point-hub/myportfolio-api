import type { IDatabase, IPipeline } from '@point-hub/papi';

import type { IBank } from '@/modules/master/banks/interface';
import type { IOwner } from '@/modules/master/owners/interface';
import type { IAuthUser } from '@/modules/master/users/interface';

import { collectionName } from '../entity';
import type { IBond } from '../interface';

export interface IRetrieveRepository {
  handle(_id: string): Promise<IRetrieveOutput | null>
  raw(_id: string): Promise<IBond | null>
}

export interface IRetrieveOutput extends IBond {
  bank_source?: IBank
  bank_placement?: IBank
  owner?: IOwner
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
    pipeline.push(...this.pipeJoinBankAccount(
      'bank_source_id',
      'bank_source_account_uuid',
      'bank_source',
    ));
    pipeline.push(...this.pipeJoinBankAccount(
      'bank_placement_id',
      'bank_placement_account_uuid',
      'bank_placement',
    ));

    pipeline.push(...this.pipeJoinReceivedCouponBank());
    pipeline.push(...this.pipeProject());

    const response = await this.database.collection(collectionName).aggregate<IRetrieveOutput>(pipeline, {}, this.options);
    if (!response || response.data.length === 0) {
      return null;
    }

    return {
      _id: response.data[0]._id,
      form_number: response.data[0].form_number,
      product: response.data[0].product,
      publisher: response.data[0].publisher,
      type: response.data[0].type,
      series: response.data[0].series,
      year_issued: response.data[0].year_issued,

      bank_source: response.data[0].bank_source,
      bank_source_id: response.data[0].bank_source_id,
      bank_source_account_uuid: response.data[0].bank_source_account_uuid,

      bank_placement: response.data[0].bank_placement,
      bank_placement_id: response.data[0].bank_placement_id,
      bank_placement_account_uuid: response.data[0].bank_placement_account_uuid,

      owner: response.data[0].owner,
      owner_id: response.data[0].owner_id,

      base_date: response.data[0].base_date,
      transaction_date: response.data[0].transaction_date,
      settlement_date: response.data[0].settlement_date,
      maturity_date: response.data[0].maturity_date,
      last_coupon_date: response.data[0].last_coupon_date,

      transaction_number: response.data[0].transaction_number,

      price: response.data[0].price,
      principal_amount: response.data[0].principal_amount,
      remaining_amount: response.data[0].remaining_amount,
      proceed_amount: response.data[0].proceed_amount,
      accrued_interest: response.data[0].accrued_interest,
      total_proceed: response.data[0].total_proceed,

      coupon_tenor: response.data[0].coupon_tenor,
      coupon_rate: response.data[0].coupon_rate,

      coupon_gross_amount: response.data[0].coupon_gross_amount,
      coupon_tax_rate: response.data[0].coupon_tax_rate,
      coupon_tax_amount: response.data[0].coupon_tax_amount,
      coupon_net_amount: response.data[0].coupon_net_amount,
      coupon_date: response.data[0].coupon_date,
      received_coupons: response.data[0].received_coupons,

      selling_price: response.data[0].selling_price,
      disbursement_date: response.data[0].disbursement_date,
      disbursement_amount: response.data[0].disbursement_amount,
      disbursement_amount_remaining: response.data[0].disbursement_amount_remaining,
      disbursement_amount_received: response.data[0].disbursement_amount_received,
      disbursement_bank_id: response.data[0].disbursement_bank_id,
      disbursement_bank_account_uuid: response.data[0].disbursement_bank_account_uuid,
      disbursement_remaining: response.data[0].disbursement_remaining,
      disbursement_notes: response.data[0].disbursement_notes,

      notes: response.data[0].notes,
      status: response.data[0].status,
      coupon_status: response.data[0].coupon_status,
      is_archived: response.data[0].is_archived,
    };
  }

  async raw(_id: string): Promise<IBond | null> {
    const response = await this.database.collection(collectionName).retrieve<IBond>(_id, this.options);
    if (!response) {
      return null;
    }

    return response;
  }

  private pipeFilter(_id: string): IPipeline[] {
    return [{ $match: { _id } }];
  }

  private pipeJoinBankAccount(
    bankIdPath: string,
    accountUuidPath: string,
    as: string,
  ): IPipeline[] {
    return [
      {
        $lookup: {
          from: 'banks',
          let: {
            bankId: `$${bankIdPath}`,
            accountUuid: `$${accountUuidPath}`,
          },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$_id', '$$bankId'] },
              },
            },
            {
              $project: {
                _id: 1,
                code: 1,
                name: 1,
                account: {
                  $first: {
                    $filter: {
                      input: '$accounts',
                      as: 'acc',
                      cond: { $eq: ['$$acc.uuid', '$$accountUuid'] },
                    },
                  },
                },
              },
            },
          ],
          as,
        },
      },
      {
        $unwind: {
          path: `$${as}`,
          preserveNullAndEmptyArrays: true,
        },
      },
    ];
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


  private pipeJoinReceivedCouponBank(): IPipeline[] {
    return [
      {
        $lookup: {
          from: 'banks',
          localField: 'received_coupons.bank_id',
          foreignField: '_id',
          as: '__banks_temp',
        },
      },
      {
        $set: {
          received_coupons: {
            $map: {
              input: { $ifNull: ['$received_coupons', []] },
              as: 'item',
              in: {
                $mergeObjects: [
                  '$$item',
                  {
                    bank: {
                      $let: {
                        vars: {
                          bankMatched: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: '$__banks_temp',
                                  as: 'b',
                                  cond: { $eq: ['$$b._id', '$$item.bank_id'] },
                                },
                              },
                              0,
                            ],
                          },
                        },
                        in: {
                          _id: '$$bankMatched._id',
                          code: '$$bankMatched.code',
                          name: '$$bankMatched.name',
                          account: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: { $ifNull: ['$$bankMatched.accounts', []] },
                                  as: 'acc',
                                  cond: { $eq: ['$$acc.uuid', '$$item.bank_account_uuid'] },
                                },
                              },
                              0,
                            ],
                          },
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
      { $unset: '__banks_temp' },
    ];
  }

  private pipeProject(): IPipeline[] {
    return [
      {
        $project: {
          _id: 1,
          form_number: 1,
          product: 1,
          year_issued: 1,
          publisher: 1,
          type: 1,
          series: 1,

          transaction_date: 1,
          settlement_date: 1,
          maturity_date: 1,
          last_coupon_date: 1,

          bank_source_account_uuid: 1,
          bank_source_id: 1,
          bank_source: 1,
          bank_placement_account_uuid: 1,
          bank_placement_id: 1,
          bank_placement: 1,
          owner_id: 1,
          owner: 1,

          base_date: 1,
          transaction_number: 1,
          price: 1,
          principal_amount: 1,
          remaining_amount: 1,
          proceed_amount: 1,
          accrued_interest: 1,
          total_proceed: 1,

          coupon_tenor: 1,
          coupon_rate: 1,
          coupon_gross_amount: 1,
          coupon_tax_rate: 1,
          coupon_tax_amount: 1,
          coupon_net_amount: 1,
          coupon_date: 1,
          received_coupons: 1,

          selling_price: 1,
          disbursement_date: 1,
          disbursement_amount: 1,
          disbursement_amount_remaining: 1,
          disbursement_amount_received: 1,
          disbursement_bank_id: 1,
          disbursement_bank_account_uuid: 1,
          disbursement_remaining: 1,
          disbursement_notes: 1,

          notes: 1,
          is_archived: 1,
          status: 1,
          coupon_status: 1,
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
