import type { IDatabase, IPagination, IPipeline, IQuery } from '@point-hub/papi';
import { BaseMongoDBQueryFilters } from '@point-hub/papi';

import { addDateRangeFilter } from '@/utils/date-range-filter';

import { collectionName } from '../entity';
import type { IBond } from '../interface';
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
  data: IBond[]
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
    pipeline.push(...this.pipeQueryFilter(query));
    pipeline.push(...this.pipeProject());

    const response = await this.database.collection(collectionName).aggregate<IRetrieveOutput>(pipeline, query, this.options);

    return {
      data: response.data.map(item => {
        return {
          _id: item._id,
          form_number: item.form_number,
          product: item.product,
          publisher: item.publisher,
          type: item.type,
          series: item.series,
          year_issued: item.year_issued,

          bank_source: item.bank_source,
          bank_source_id: item.bank_source_id,
          bank_source_account_uuid: item.bank_source_account_uuid,

          bank_placement: item.bank_placement,
          bank_placement_id: item.bank_placement_id,
          bank_placement_account_uuid: item.bank_placement_account_uuid,

          owner: item.owner,
          owner_id: item.owner_id,

          base_date: item.base_date,
          transaction_date: item.transaction_date,
          settlement_date: item.settlement_date,
          maturity_date: item.maturity_date,

          transaction_number: item.transaction_number,

          price: item.price,
          principal_amount: item.principal_amount,
          proceed_amount: item.proceed_amount,
          accrued_interest: item.accrued_interest,
          total_proceed: item.total_proceed,

          coupon_tenor: item.coupon_tenor,
          coupon_rate: item.coupon_rate,

          coupon_gross_amount: item.coupon_gross_amount,
          coupon_tax_rate: item.coupon_tax_rate,
          coupon_tax_amount: item.coupon_tax_amount,
          coupon_net_amount: item.coupon_net_amount,

          notes: item.notes,
          status: item.status,
          is_archived: item.is_archived,
        };
      }),
      pagination: response.pagination,
    };
  }

  async raw(query: IQuery): Promise<IRetrieveManyRawOutput> {
    return await this.database.collection(collectionName).retrieveMany<IBond>(query, this.options);
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
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'bank_source.account.account_number', query?.['search.bank_source.account.account_number']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'bank_source.account.account_name', query?.['search.bank_source.account.account_name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'transaction_number', query?.['search.transaction_number']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'product', query?.['search.product']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'series', query?.['search.series']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'year_issued', query?.['search.year_issued']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'type', query?.['search.type']);

    // Filter date
    addDateRangeFilter(filters, 'transaction_date', query?.['search.transaction_date_from'], query?.['search.transaction_date_to']);
    addDateRangeFilter(filters, 'settlement_date', query?.['search.settlement_date_from'], query?.['search.settlement_date_to']);
    addDateRangeFilter(filters, 'maturity_date', query?.['search.maturity_date_from'], query?.['search.maturity_date_to']);
    addDateRangeFilter(filters, 'created_at', query?.['search.created_at_from'], query?.['search.created_at_to']);

    // Apply numeric filter using the helper function
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'base_date', query?.['search.base_date']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'price', query?.['search.price']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'principal_amount', query?.['search.principal_amount']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'remaining_amount', query?.['search.remaining_amount']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'proceed_amount', query?.['search.proceed_amount']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'accrued_interest', query?.['search.accrued_interest']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'total_proceed', query?.['search.total_proceed']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'coupon_rate', query?.['search.coupon_rate']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'coupon_gross_amount', query?.['search.coupon_gross_amount']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'coupon_tax_rate', query?.['search.coupon_tax_rate']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'coupon_tax_amount', query?.['search.coupon_tax_amount']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'coupon_net_amount', query?.['search.coupon_net_amount']);

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
