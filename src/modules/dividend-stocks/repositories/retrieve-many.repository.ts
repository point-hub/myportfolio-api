import type { IDatabase, IPagination, IPipeline, IQuery } from '@point-hub/papi';
import { BaseMongoDBQueryFilters } from '@point-hub/papi';

import { addDateRangeFilter } from '@/utils/date-range-filter';

import { collectionName } from '../entity';
import type { IDividendStock } from '../interface';
import type { IRetrieveOutput } from './retrieve.repository';

export interface IRetrieveManyRepository {
  handle(query: IQuery): Promise<IRetrieveManyOutput>
  raw(query: IQuery): Promise<IRetrieveManyRawOutput>
}

export interface IRetrieveManyOutput {
  data: IRetrieveOutput[]
  pagination: IPagination
}

export interface IRetrieveManyRawOutput {
  data: IDividendStock[]
  pagination: IPagination
}

export class RetrieveManyRepository implements IRetrieveManyRepository {
  constructor(
    public database: IDatabase,
    public options?: Record<string, unknown>,
  ) { }

  async handle(query: IQuery): Promise<IRetrieveManyOutput> {
    const pipeline: IPipeline[] = [];

    pipeline.push(...this.pipeJoinCreatedById());
    pipeline.push(...this.pipeJoinBrokerId());
    pipeline.push(...this.pipeJoinTransactions());
    pipeline.push(...this.pipeJoinBankAccount(
      'bank_id',
      'bank_account_uuid',
      'bank',
    ));
    pipeline.push(...this.pipeQueryFilter(query));
    pipeline.push(...this.pipeProject());

    const response = await this.database.collection(collectionName).aggregate<IRetrieveOutput>(pipeline, query, this.options);

    return {
      data: response.data.map(item => {
        return {
          _id: item._id,
          form_number: item.form_number,
          dividend_date: item.dividend_date,
          broker_id: item.broker_id,
          broker: item.broker,
          bank_id: item.bank_id,
          bank_account_uuid: item.bank_account_uuid,
          bank: item.bank,
          transactions: item.transactions,
          total_received: item.total_received,
          notes: item.notes,
          status: item.status,
          is_archived: item.is_archived,
        };
      }),
      pagination: response.pagination,
    };
  }

  async raw(query: IQuery): Promise<IRetrieveManyRawOutput> {
    return await this.database.collection(collectionName).retrieveMany<IDividendStock>(query, this.options);
  }

  private pipeQueryFilter(query: IQuery): IPipeline[] {
    const filters: Record<string, unknown>[] = [];

    // General search across multiple fields
    if (query?.['search.all']) {
      const searchRegex = { $regex: query?.['search.all'], $options: 'i' };
      const fields = ['form_number', 'broker.name'];
      filters.push({
        $or: fields.map((field) => ({ [field]: searchRegex })),
      });
    }

    // Filter specific field
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'form_number', query?.['search.form_number']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'broker.name', query?.['search.broker.name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'bank.account.account_name', query?.['search.bank.account.account_name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'bank.account.account_number', query?.['search.bank.account.account_number']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'transactions.owner.name', query?.['search.transactions.owner.name']);

    // Filter date
    addDateRangeFilter(filters, 'dividend_date', query?.['search.dividend_date_from'], query?.['search.dividend_date_to']);
    addDateRangeFilter(filters, 'created_at', query?.['search.created_at_from'], query?.['search.created_at_to']);

    // Apply numeric filter using the helper function
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'total_received', query?.['search.total_received']);

    // Filter boolean
    BaseMongoDBQueryFilters.addBooleanFilter(filters, 'is_archived', query?.['search.is_archived']);

    BaseMongoDBQueryFilters.addExactFilter(filters, 'status', query?.['search.status']);

    return filters.length > 0 ? [{ $match: { $and: filters } }] : [];
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
