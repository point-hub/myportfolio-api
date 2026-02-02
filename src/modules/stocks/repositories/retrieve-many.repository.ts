import type { IDatabase, IPagination, IPipeline, IQuery } from '@point-hub/papi';
import { BaseMongoDBQueryFilters } from '@point-hub/papi';

import { addDateRangeFilter } from '@/utils/date-range-filter';

import { collectionName } from '../entity';
import type { IStock } from '../interface';
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
  data: IStock[]
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
    pipeline.push(...this.pipeJoinOwnerId());
    pipeline.push(...this.pipeJoinBrokerId());
    pipeline.push(...this.pipeJoinListIssuer(
      'buying_list.issuer_id',
      'buying_list.issuer',
    ));
    pipeline.push(...this.pipeJoinListIssuer(
      'selling_list.issuer_id',
      'selling_list.issuer',
    ));
    pipeline.push(...this.pipeQueryFilter(query));
    pipeline.push(...this.pipeProject());

    const response = await this.database.collection(collectionName).aggregate<IRetrieveOutput>(pipeline, query, this.options);

    return {
      data: response.data.map(item => {
        return {
          _id: item._id,
          form_number: item.form_number,
          transaction_date: item.transaction_date,
          settlement_date: item.settlement_date,
          broker_id: item.broker_id,
          broker: item.broker,
          transaction_number: item.transaction_number!,
          owner_id: item.owner_id,
          owner: item.owner,
          buying_list: item.buying_list,
          selling_list: item.selling_list,
          buying_total: item.buying_total,
          buying_brokerage_fee: item.buying_brokerage_fee,
          buying_vat: item.buying_vat,
          buying_levy: item.buying_levy,
          buying_kpei: item.buying_kpei,
          buying_stamp: item.buying_stamp,
          buying_proceed: item.buying_proceed,
          selling_total: item.selling_total,
          selling_brokerage_fee: item.selling_brokerage_fee,
          selling_vat: item.selling_vat,
          selling_levy: item.selling_levy,
          selling_kpei: item.selling_kpei,
          selling_stamp: item.selling_stamp,
          selling_proceed: item.selling_proceed,
          proceed_amount: item.proceed_amount,
          notes: item.notes,
          status: item.status,
          is_archived: item.is_archived,
        };
      }),
      pagination: response.pagination,
    };
  }

  async raw(query: IQuery): Promise<IRetrieveManyRawOutput> {
    return await this.database.collection(collectionName).retrieveMany<IStock>(query, this.options);
  }

  private pipeQueryFilter(query: IQuery): IPipeline[] {
    const filters: Record<string, unknown>[] = [];

    // General search across multiple fields
    if (query?.['search.all']) {
      const searchRegex = { $regex: query?.['search.all'], $options: 'i' };
      const fields = ['form_number', 'owner.name', 'broker.name', 'transaction_number'];
      filters.push({
        $or: fields.map((field) => ({ [field]: searchRegex })),
      });
    }

    // Filter specific field
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'form_number', query?.['search.form_number']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'owner.name', query?.['search.owner.name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'broker.name', query?.['search.broker.name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'transaction_number', query?.['search.transaction_number']);

    // Filter date
    addDateRangeFilter(filters, 'transaction_date', query?.['search.transaction_date_from'], query?.['search.transaction_date_to']);
    addDateRangeFilter(filters, 'settlement_date_date', query?.['search.settlement_date_date_from'], query?.['search.settlement_date_date_to']);
    addDateRangeFilter(filters, 'created_at_date', query?.['search.created_at_date_from'], query?.['search.created_at_date_to']);

    // Apply numeric filter using the helper function
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'buying_total', query?.['search.buying_total']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'buying_brokerage_fee', query?.['search.buying_brokerage_fee']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'buying_vat', query?.['search.buying_vat']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'buying_levy', query?.['search.buying_levy']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'buying_kpei', query?.['search.buying_kpei']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'buying_stamp', query?.['search.buying_stamp']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'buying_proceed', query?.['search.buying_proceed']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'selling_total', query?.['search.selling_total']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'selling_brokerage_fee', query?.['search.selling_brokerage_fee']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'selling_vat', query?.['search.selling_vat']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'selling_levy', query?.['search.selling_levy']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'selling_kpei', query?.['search.selling_kpei']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'selling_stamp', query?.['search.selling_stamp']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'selling_proceed', query?.['search.selling_proceed']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'proceed_amount', query?.['search.proceed_amount']);

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

  private pipeJoinListIssuer(
    issuerIdPath: string,
    as: string,
  ): IPipeline[] {
    return [
      {
        $lookup: {
          from: 'issuers',
          let: {
            issuerId: `$${issuerIdPath}`,
          },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$_id', '$$issuerId'] },
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
