import type { IDatabase, IPagination, IPipeline, IQuery } from '@point-hub/papi';
import { BaseMongoDBQueryFilters } from '@point-hub/papi';

import type { IBank } from '@/modules/master/banks/interface';
import type { IOwner } from '@/modules/master/owners/interface';
import type { IAuthUser } from '@/modules/master/users/interface';
import { addDateRangeFilter } from '@/utils/date-range-filter';

import { collectionName } from '../entity';
import type { IBond } from '../interface';

export interface IRetrieveCouponsRepository {
  handle(query: IQuery): Promise<IRetrieveCouponsOutput>
  raw(query: IQuery): Promise<IRetrieveCouponsRawOutput>
}

export interface IRetrieveOutput extends IBond {
  bank_source?: IBank
  bank_placement?: IBank
  owner?: IOwner
  created_by?: IAuthUser
  updated_by?: IAuthUser
  archived_by?: IAuthUser
}

export interface IRetrieveCouponsOutput {
  data: IRetrieveOutput[]
  pagination: IPagination
}

export interface IRetrieveCouponsRawOutput {
  data: IBond[]
  pagination: IPagination
}

export class RetrieveCouponsRepository implements IRetrieveCouponsRepository {
  constructor(
    public database: IDatabase,
    public options?: Record<string, unknown>,
  ) { }

  async handle(query: IQuery): Promise<IRetrieveCouponsOutput> {
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
    pipeline.push({
      $unwind: {
        path: '$received_coupons',
        preserveNullAndEmptyArrays: true,
      },
    });

    pipeline.push(...this.pipeJoinBankAccount(
      'received_coupos.bank_id',
      'received_coupos.bank_account_uuid',
      'received_coupos.bank',
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
          coupon_date: item.coupon_date,
          received_coupons: item.received_coupons,

          notes: item.notes,
          status: item.status,
          coupon_status: item.coupon_status,
          is_archived: item.is_archived,
        };
      }),
      pagination: response.pagination,
    };
  }

  async raw(query: IQuery): Promise<IRetrieveCouponsRawOutput> {
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
      const fields = ['form_number', 'owner.name', 'product', 'type'];
      filters.push({
        $or: fields.map((field) => ({ [field]: searchRegex })),
      });
    }

    // Filter specific field
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'form_number', query?.['search.form_number']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'owner.name', query?.['search.owner.name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'product', query?.['search.product']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'type', query?.['search.type']);

    // Filter date
    addDateRangeFilter(filters, 'received_coupons.date', query?.['search.received_coupons.date_from'], query?.['search.received_coupons.date_to']);
    addDateRangeFilter(filters, 'created_at', query?.['search.created_at_from'], query?.['search.created_at_to']);

    // Apply numeric filter using the helper function
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'coupon_rate', query?.['search.coupon_rate']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'coupon_gross_amount', query?.['search.coupon_gross_amount']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'coupon_tax_rate', query?.['search.coupon_tax_rate']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'coupon_tax_amount', query?.['search.coupon_tax_amount']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'coupon_net_amount', query?.['search.coupon_net_amount']);

    // Filter boolean
    BaseMongoDBQueryFilters.addBooleanFilter(filters, 'is_archived', query?.['search.is_archived']);

    BaseMongoDBQueryFilters.addExactFilter(filters, 'status', query?.['search.status']);

    if (query?.['search.coupon_status']) {
      if (query?.['search.coupon_status'] === 'completed') {
        filters.push(
          {
            'received_coupons.received_date': { $exists: true },
          },
        );
      } else if (query?.['search.coupon_status'] === 'pending') {
        filters.push(
          {
            'received_coupons.received_date': { $exists: false },
          },
        );
      }
    }

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
          received_coupons: 1,

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
