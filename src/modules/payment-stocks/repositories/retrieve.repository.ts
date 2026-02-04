import type { IDatabase, IPipeline } from '@point-hub/papi';

import type { IBroker } from '@/modules/master/brokers/interface';
import type { IAuthUser } from '@/modules/master/users/interface';
import type { IStock } from '@/modules/stocks/interface';

import { collectionName } from '../entity';
import type { IPaymentStock } from '../interface';

export interface IRetrieveRepository {
  handle(_id: string): Promise<IRetrieveOutput | null>
  raw(_id: string): Promise<IPaymentStock | null>
}

export interface IRetrieveOutput extends IPaymentStock {
  form_number?: string
  broker_id?: string
  broker?: IBroker
  payment_date?: string
  transactions?: {
    uuid?: string
    stock_id?: string
    stock?: IStock
    transaction_number?: number
    date?: string
    amount?: number
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
    pipeline.push(...this.pipeJoinBrokerId());
    pipeline.push(...this.pipeJoinTransactionsStock());
    pipeline.push(...this.pipeProject());

    const response = await this.database.collection(collectionName).aggregate<IRetrieveOutput>(pipeline, {}, this.options);
    if (!response || response.data.length === 0) {
      return null;
    }

    return {
      _id: response.data[0]._id,
      form_number: response.data[0].form_number,
      payment_date: response.data[0].payment_date,
      broker_id: response.data[0].broker_id,
      broker: response.data[0].broker,
      transactions: response.data[0].transactions,
      total: response.data[0].total,
      notes: response.data[0].notes,
      status: response.data[0].status,
      is_archived: response.data[0].is_archived,
    };
  }

  async raw(_id: string): Promise<IPaymentStock | null> {
    const response = await this.database.collection(collectionName).retrieve<IPaymentStock>(_id, this.options);
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

  private pipeJoinTransactionsStock(): IPipeline[] {
    return [
      {
        $lookup: {
          from: 'stocks',
          localField: 'transactions.stock_id',
          foreignField: '_id',
          as: '__stocks_temp',
        },
      },
      {
        $set: {
          transactions: {
            $map: {
              input: { $ifNull: ['$transactions', []] },
              as: 'item',
              in: {
                $mergeObjects: [
                  '$$item',
                  {
                    stock: {
                      $let: {
                        vars: {
                          stockMatched: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: '$__stocks_temp',
                                  as: 'b',
                                  cond: { $eq: ['$$b._id', '$$item.stock_id'] },
                                },
                              },
                              0,
                            ],
                          },
                        },
                        in: {
                          _id: '$$stockMatched._id',
                          transaction_date: '$$stockMatched.transaction_date',
                          transaction_number: '$$stockMatched.transaction_number',
                          proceed_amount: '$$stockMatched.proceed_amount',
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
      { $unset: '__stocks_temp' },
    ];
  }

  private pipeProject(): IPipeline[] {
    return [
      {
        $project: {
          _id: 1,
          form_number: 1,
          payment_date: 1,
          broker_id: 1,
          broker: 1,
          transactions: 1,
          total: 1,
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
