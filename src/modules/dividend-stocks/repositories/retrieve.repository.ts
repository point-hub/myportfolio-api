import type { IDatabase, IPipeline } from '@point-hub/papi';

import type { IBank } from '@/modules/master/banks/interface';
import type { IBroker } from '@/modules/master/brokers/interface';
import type { IIssuer } from '@/modules/master/issuers/interface';
import type { IOwner } from '@/modules/master/owners/interface';
import type { IAuthUser } from '@/modules/master/users/interface';

import { collectionName } from '../entity';
import type { IDividendStock } from '../interface';

export interface IRetrieveRepository {
  handle(_id: string): Promise<IRetrieveOutput | null>
  raw(_id: string): Promise<IDividendStock | null>
}

export interface IRetrieveOutput extends IDividendStock {
  form_number?: string
  dividend_date?: string
  broker_id?: string
  broker?: IBroker
  bank_id?: string
  bank_account_uuid?: string
  bank?: IBank
  transactions?: {
    uuid?: string
    issuer_id?: string
    issuer?: IIssuer
    owner_id?: string
    owner?: IOwner
    dividend_date?: string
    shared?: number
    dividend_amount?: number
    total_dividend?: number
    received_amount?: number
  }[]
  total_received?: number
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
    pipeline.push(...this.pipeJoinBrokerId());
    pipeline.push(...this.pipeJoinBankAccount(
      'bank_id',
      'bank_account_uuid',
      'bank',
    ));
    pipeline.push(...this.pipeJoinTransactions());
    pipeline.push(...this.pipeProject());

    const response = await this.database.collection(collectionName).aggregate<IRetrieveOutput>(pipeline, {}, this.options);
    if (!response || response.data.length === 0) {
      return null;
    }

    return {
      _id: response.data[0]._id,
      form_number: response.data[0].form_number,
      dividend_date: response.data[0].dividend_date,
      broker_id: response.data[0].broker_id,
      broker: response.data[0].broker,
      bank_id: response.data[0].bank_id,
      bank_account_uuid: response.data[0].bank_account_uuid,
      bank: response.data[0].bank,
      transactions: response.data[0].transactions,
      total_received: response.data[0].total_received,
      notes: response.data[0].notes,
      status: response.data[0].status,
      is_archived: response.data[0].is_archived,
    };
  }

  async raw(_id: string): Promise<IDividendStock | null> {
    const response = await this.database.collection(collectionName).retrieve<IDividendStock>(_id, this.options);
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

  private pipeJoinTransactions(): IPipeline[] {
    return [
      {
        $lookup: {
          from: 'issuers',
          let: { issuerIds: '$transactions.issuer_id' },
          pipeline: [
            {
              $match: {
                $expr: { $in: ['$_id', '$$issuerIds'] },
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
          as: 'issuer_refs',
        },
      },
      {
        $lookup: {
          from: 'owners',
          let: { ownerIds: '$transactions.owner_id' },
          pipeline: [
            {
              $match: {
                $expr: { $in: ['$_id', '$$ownerIds'] },
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
          as: 'owner_refs',
        },
      },
      {
        $addFields: {
          transactions: {
            $map: {
              input: '$transactions',
              as: 'trx',
              in: {
                $mergeObjects: [
                  '$$trx',
                  {
                    issuer: {
                      $first: {
                        $filter: {
                          input: '$issuer_refs',
                          as: 'iss',
                          cond: { $eq: ['$$iss._id', '$$trx.issuer_id'] },
                        },
                      },
                    },
                    owner: {
                      $first: {
                        $filter: {
                          input: '$owner_refs',
                          as: 'own',
                          cond: { $eq: ['$$own._id', '$$trx.owner_id'] },
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
      {
        $project: {
          issuer_refs: 0,
          owner_refs: 0,
        },
      },
    ];
  }

  private pipeProject(): IPipeline[] {
    return [
      {
        $project: {
          _id: 1,
          form_number: 1,
          dividend_date: 1,
          broker_id: 1,
          broker: 1,
          bank_id: 1,
          bank_account_uuid: 1,
          bank: 1,
          transactions: 1,
          total_received: 1,
          notes: 1,
          status: 1,
          is_archived: 1,
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
