import type { IDatabase, IPipeline } from '@point-hub/papi';

import type { IBank } from '@/modules/master/banks/interface';
import type { IOwner } from '@/modules/master/owners/interface';
import type { IAuthUser } from '@/modules/master/users/interface';

import { collectionName } from '../entity';
import type { ISaving } from '../interface';

export interface IRetrieveRepository {
  handle(_id: string): Promise<IRetrieveOutput | null>
  raw(_id: string): Promise<ISaving | null>
}

export interface IRetrieveOutput {
  _id: string
  form_number?: string
  owner_id?: string
  owner?: IOwner
  group_id?: string
  group?: IOwner
  placement?: {
    type?: string
    account_number?: string
    base_date?: number
    date?: string
    term?: number
    maturity_date?: string
    bank?: IBank
    amount?: number
  }
  source?: {
    bank?: IBank
  }
  interest?: {
    payment_method?: string
    rate?: number
    gross_amount?: number
    tax_rate?: number
    tax_amount?: number
    net_amount?: number
    bank?: IBank
    is_rollover?: boolean
  }
  interest_schedule?: {
    term?: number
    payment_date?: string
    amount?: number
  }[]
  cashback?: {
    bank?: IBank
  }
  cashback_schedule?: {
    payment_date?: string
    rate?: number
    amount?: number
  }[]
  withdrawal?: {
    received_date?: string
    received_amount?: number
    remaining_amount?: number
    bank?: IBank
  }
  notes: string
  is_archived: boolean
  status: 'draft' | 'active' | 'withdrawn' | 'renewed'
  created_at: Date
  created_by: IAuthUser
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
    pipeline.push(...this.pipeJoinGroupId());
    pipeline.push(...this.pipeJoinBankId());
    pipeline.push(...this.pipeJoinBankAccount(
      'source.bank_id',
      'source.bank_account_uuid',
      'source.bank',
    ));
    pipeline.push(...this.pipeJoinBankAccount(
      'cashback.bank_id',
      'cashback.bank_account_uuid',
      'cashback.bank',
    ));
    pipeline.push(...this.pipeJoinBankAccount(
      'interest.bank_id',
      'interest.bank_account_uuid',
      'interest.bank',
    ));
    pipeline.push(...this.pipeJoinBankAccount(
      'withdrawal.bank_id',
      'withdrawal.bank_account_uuid',
      'withdrawal.bank',
    ));
    pipeline.push(...this.pipeJoinInterestScheduleBank());
    pipeline.push(...this.pipeJoinInterestScheduleCreatedBy());
    pipeline.push(...this.pipeJoinCashbackScheduleBank());
    pipeline.push(...this.pipeJoinCashbackScheduleCreatedBy());
    pipeline.push(...this.pipeProject());

    const response = await this.database.collection(collectionName).aggregate<IRetrieveOutput>(pipeline, {}, this.options);
    if (!response || response.data.length === 0) {
      return null;
    }

    return {
      _id: response.data[0]._id,
      form_number: response.data[0].form_number,
      owner_id: response.data[0].owner_id,
      owner: response.data[0].owner,
      group_id: response.data[0].group_id,
      group: response.data[0].group,
      placement: response.data[0].placement,
      source: response.data[0].source,
      interest: response.data[0].interest,
      interest_schedule: response.data[0].interest_schedule,
      cashback: response.data[0].cashback,
      cashback_schedule: response.data[0].cashback_schedule,
      notes: response.data[0].notes,
      withdrawal: response.data[0].withdrawal,
      is_archived: response.data[0].is_archived,
      status: response.data[0].status,
      created_at: response.data[0].created_at,
      created_by: response.data[0].created_by,
    };
  }

  async raw(_id: string): Promise<ISaving | null> {
    const response = await this.database.collection(collectionName).retrieve<ISaving>(_id, this.options);
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

  private pipeJoinGroupId(): IPipeline[] {
    return [
      {
        $lookup: {
          from: 'owners',
          let: { groupId: '$group_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$groupId'] } } },
            {
              $project: {
                _id: 1,
                code: 1,
                name: 1,
              },
            },
          ],
          as: 'group',
        },
      },
      {
        $unwind: {
          path: '$group',
          preserveNullAndEmptyArrays: true,
        },
      },
    ];
  }

  private pipeJoinBankId(): IPipeline[] {
    return [
      {
        $lookup: {
          from: 'banks',
          let: { bankId: '$placement.bank_id' },
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
              },
            },
          ],
          as: 'placement.bank',
        },
      },
      {
        $unwind: {
          path: '$placement.bank',
          preserveNullAndEmptyArrays: true,
        },
      },
    ];
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

  private pipeJoinInterestScheduleBank(): IPipeline[] {
    return [
      {
        $lookup: {
          from: 'banks',
          localField: 'interest_schedule.bank_id',
          foreignField: '_id',
          as: '__banks_temp',
        },
      },
      {
        $set: {
          interest_schedule: {
            $map: {
              input: { $ifNull: ['$interest_schedule', []] },
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
                  {
                    additional_bank: {
                      $let: {
                        vars: {
                          matchedBank: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: { $ifNull: ['$__banks_temp', []] },
                                  as: 'b',
                                  cond: { $eq: ['$$b._id', '$$item.additional_bank_id'] },
                                },
                              },
                              0,
                            ],
                          },
                        },
                        in: {
                          _id: '$$matchedBank._id',
                          code: '$$matchedBank.code',
                          name: '$$matchedBank.name',
                          account: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: { $ifNull: ['$$matchedBank.accounts', []] },
                                  as: 'acc',
                                  cond: { $eq: ['$$acc.uuid', '$$item.additional_bank_account_uuid'] },
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

  private pipeJoinInterestScheduleCreatedBy(): IPipeline[] {
    return [
      {
        $lookup: {
          from: 'users',
          localField: 'interest_schedule.created_by_id',
          foreignField: '_id',
          as: '__users_temp',
        },
      },
      {
        $set: {
          interest_schedule: {
            $map: {
              input: { $ifNull: ['$interest_schedule', []] },
              as: 'item',
              in: {
                $mergeObjects: [
                  '$$item',
                  {
                    created_by: {
                      $let: {
                        vars: {
                          userMatched: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: '$__users_temp',
                                  as: 'u',
                                  cond: { $eq: ['$$u._id', '$$item.created_by_id'] },
                                },
                              },
                              0,
                            ],
                          },
                        },
                        in: {
                          _id: '$$userMatched._id',
                          name: '$$userMatched.name',
                          username: '$$userMatched.username',
                          email: '$$userMatched.email',
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
      { $unset: '__users_temp' },
    ];
  }

  private pipeJoinCashbackScheduleBank(): IPipeline[] {
    return [
      {
        $lookup: {
          from: 'banks',
          localField: 'cashback_schedule.bank_id',
          foreignField: '_id',
          as: '__banks_temp',
        },
      },
      {
        $set: {
          cashback_schedule: {
            $map: {
              input: { $ifNull: ['$cashback_schedule', []] },
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
                  {
                    additional_bank: {
                      $let: {
                        vars: {
                          matchedBank: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: { $ifNull: ['$__banks_temp', []] },
                                  as: 'b',
                                  cond: { $eq: ['$$b._id', '$$item.additional_bank_id'] },
                                },
                              },
                              0,
                            ],
                          },
                        },
                        in: {
                          _id: '$$matchedBank._id',
                          code: '$$matchedBank.code',
                          name: '$$matchedBank.name',
                          account: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: { $ifNull: ['$$matchedBank.accounts', []] },
                                  as: 'acc',
                                  cond: { $eq: ['$$acc.uuid', '$$item.additional_bank_account_uuid'] },
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

  private pipeJoinCashbackScheduleCreatedBy(): IPipeline[] {
    return [
      {
        $lookup: {
          from: 'users',
          localField: 'cashback_schedule.created_by_id',
          foreignField: '_id',
          as: '__users_temp',
        },
      },
      {
        $set: {
          cashback_schedule: {
            $map: {
              input: { $ifNull: ['$cashback_schedule', []] },
              as: 'item',
              in: {
                $mergeObjects: [
                  '$$item',
                  {
                    created_by: {
                      $let: {
                        vars: {
                          userMatched: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: '$__users_temp',
                                  as: 'u',
                                  cond: { $eq: ['$$u._id', '$$item.created_by_id'] },
                                },
                              },
                              0,
                            ],
                          },
                        },
                        in: {
                          _id: '$$userMatched._id',
                          name: '$$userMatched.name',
                          username: '$$userMatched.username',
                          email: '$$userMatched.email',
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
      { $unset: '__users_temp' },
    ];
  }

  private pipeProject(): IPipeline[] {
    return [
      {
        $project: {
          _id: 1,
          form_number: 1,
          owner_id: 1,
          owner: 1,
          group_id: 1,
          group: 1,
          placement: 1,
          source: 1,
          interest: 1,
          interest_schedule: 1,
          cashback: 1,
          cashback_schedule: 1,
          notes: 1,
          withdrawal: 1,
          is_archived: 1,
          status: 1,
          created_at: 1,
          created_by: 1,
        },
      },
    ];
  }
}
