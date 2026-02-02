import type { IDatabase, IPagination, IPipeline, IQuery } from '@point-hub/papi';
import { BaseMongoDBQueryFilters } from '@point-hub/papi';

import { addDateRangeFilter } from '@/utils/date-range-filter';

import { collectionName } from '../entity';
import type { IPaymentStock } from '../interface';
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
  data: IPaymentStock[]
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
    pipeline.push(...this.pipeJoinTransactionsStock(
      'transactions.stock_id',
      'transactions.stock',
    ));
    pipeline.push(...this.pipeQueryFilter(query));
    pipeline.push(...this.pipeProject());

    const response = await this.database.collection(collectionName).aggregate<IRetrieveOutput>(pipeline, query, this.options);

    return {
      data: response.data.map(item => {
        return {
          _id: item._id,
          form_number: item.form_number,
          payment_date: item.payment_date,
          broker_id: item.broker_id,
          broker: item.broker,
          transactions: item.transactions,
          total: item.total,
          notes: item.notes,
          status: item.status,
          is_archived: item.is_archived,
        };
      }),
      pagination: response.pagination,
    };
  }

  async raw(query: IQuery): Promise<IRetrieveManyRawOutput> {
    return await this.database.collection(collectionName).retrieveMany<IPaymentStock>(query, this.options);
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

    // Filter date
    addDateRangeFilter(filters, 'payment_date', query?.['search.payment_date_from'], query?.['search.payment_date_to']);
    addDateRangeFilter(filters, 'created_at_date', query?.['search.created_at_date_from'], query?.['search.created_at_date_to']);

    // Apply numeric filter using the helper function
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'total', query?.['search.total']);

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

  private pipeJoinTransactionsStock(
    stockIdPath: string,
    as: string,
  ): IPipeline[] {
    return [
      {
        $lookup: {
          from: 'stocks',
          let: {
            stockId: `$${stockIdPath}`,
          },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$_id', '$$stockId'] },
              },
            },
            {
              $project: {
                _id: 1,
                transaction_date: 1,
                transaction_number: 1,
                proceed_amount: 1,
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
