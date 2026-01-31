import type { IDatabase, IPagination, IPipeline, IQuery } from '@point-hub/papi';
import { BaseMongoDBQueryFilters } from '@point-hub/papi';

import { addDateRangeFilter } from '@/utils/date-range-filter';

import { collectionName } from '../entity';
import type { IDeposit } from '../interface';
import type { IRetrieveOutput } from './retrieve.repository';

export interface IRetrieveCashbacksRepository {
  handle(query: IQuery): Promise<IRetrieveManyOutput>
  raw(query: IQuery): Promise<IRetrieveManyRawOutput>
}

export interface IRetrieveManyOutput {
  data: IRetrieveOutput[]
  pagination: IPagination
}

export interface IRetrieveManyRawOutput {
  data: IDeposit[]
  pagination: IPagination
}

export class RetrieveCashbacksRepository implements IRetrieveCashbacksRepository {
  constructor(
    public database: IDatabase,
    public options?: Record<string, unknown>,
  ) { }

  async handle(query: IQuery): Promise<IRetrieveManyOutput> {
    const pipeline: IPipeline[] = [];

    pipeline.push(...this.pipeFlatInterestSchedule());
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
      'cashback_schedule.bank_id',
      'cashback_schedule.bank_account_uuid',
      'cashback_schedule.bank',
    ));
    pipeline.push(...this.pipeJoinBankAccount(
      'cashback_schedule.additional_bank_id',
      'cashback_schedule.additional_bank_account_uuid',
      'cashback_schedule.additional_bank',
    ));
    pipeline.push(...this.pipeJoinInterestScheduleCreatedBy());
    pipeline.push(...this.pipeQueryFilter(query));
    pipeline.push(...this.pipeProject());

    const response = await this.database.collection(collectionName).aggregate<IRetrieveOutput>(pipeline, query, this.options);

    return {
      data: response.data.map(item => {
        return {
          _id: item._id,
          form_number: item.form_number,
          owner: item.owner,
          group: item.group,
          placement: item.placement,
          source: item.source,
          interest: item.interest,
          interest_schedule: item.interest_schedule,
          cashback: item.cashback,
          cashback_schedule: item.cashback_schedule,
          notes: item.notes,
          is_archived: item.is_archived,
          status: item.status,
          created_at: item.created_at,
          created_by: item.created_by,
        };
      }),
      pagination: response.pagination,
    };
  }

  async raw(query: IQuery): Promise<IRetrieveManyRawOutput> {
    return await this.database.collection(collectionName).retrieveMany<IDeposit>(query, this.options);
  }

  private pipeFlatInterestSchedule(): IPipeline[] {
    return [
      {
        $unwind: {
          path: '$cashback_schedule',
          preserveNullAndEmptyArrays: false, // drop deposits without schedule
        },
      },
    ];
  }

  private pipeQueryFilter(query: IQuery): IPipeline[] {
    const filters: Record<string, unknown>[] = [];

    // General search across multiple fields
    if (query?.['search.all']) {
      const searchRegex = { $regex: query?.['search.all'], $options: 'i' };
      const fields = ['form_number', 'owner.name', 'group.name', 'placement.bilyet_number'];
      filters.push({
        $or: fields.map((field) => ({ [field]: searchRegex })),
      });
    }

    // Filter specific field
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'form_number', query?.['search.form_number']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'owner.name', query?.['search.owner.name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'group.name', query?.['search.group.name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'placement.payment_method', query?.['search.placement.payment_method']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'placement.bank.name', query?.['search.placement.bank.name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'placement.bank.account_number', query?.['search.placement.bank.account_number']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'placement.bank.account_name', query?.['search.placement.bank.account_name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'placement.bilyet_number', query?.['search.placement.bilyet_number']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'source.bank.name', query?.['search.source.bank.name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'source.bank.account.account_number', query?.['search.source.bank.account.account_number']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'source.bank.account.account_name', query?.['search.source.bank.account.account_name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'source.bank.code', query?.['search.source.bank.code']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'interest.bank.name', query?.['search.interest.bank.name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'interest.bank.account.account_number', query?.['search.interest.bank.account.account_number']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'interest.bank.account.account_name', query?.['search.interest.bank.account.account_name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'cashback_schedule.bank.name', query?.['search.cashback_schedule.bank.name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'cashback_schedule.bank.account.account_number', query?.['search.cashback_schedule.bank.account.account_number']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'cashback_schedule.bank.account.account_name', query?.['search.cashback_schedule.bank.account.account_name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'cashback_schedule.additional_bank.name', query?.['search.cashback_schedule.additional_bank.name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'cashback_schedule.additional_bank.account.account_number', query?.['search.cashback_schedule.additional_bank.account.account_number']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'cashback_schedule.additional_bank.account.account_name', query?.['search.cashback_schedule.additional_bank.account.account_name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'cashback_schedule.bank.name', query?.['search.cashback_schedule.bank.name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'cashback.bank.account.account_number', query?.['search.cashback.bank.account.account_number']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'cashback.bank.account.account_name', query?.['search.cashback.bank.account.account_name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'cashback.bank.name', query?.['search.cashback.bank.name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'cashback_schedule.bank.account.account_number', query?.['search.cashback_schedule.bank.account.account_number']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'cashback_schedule.bank.account.account_name', query?.['search.cashback_schedule.bank.account.account_name']);

    // Filter date
    addDateRangeFilter(filters, 'placement.date', query?.['search.placement.date_from'], query?.['search.placement.date_to']);
    addDateRangeFilter(filters, 'placement.maturity_date', query?.['search.placement.maturity_date_from'], query?.['search.placement.maturity_date_to']);
    addDateRangeFilter(filters, 'cashback_schedule.payment_date', query?.['search.cashback_schedule.payment_date_from'], query?.['search.cashback_schedule.payment_date_to']);
    addDateRangeFilter(filters, 'cashback_schedule.received_date', query?.['search.cashback_schedule.received_date_from'], query?.['search.cashback_schedule.received_date_to']);
    addDateRangeFilter(filters, 'cashback_schedule.received_additional_payment_date', query?.['search.cashback_schedule.received_additional_payment_date_from'], query?.['search.cashback_schedule.received_additional_payment_date_to']);
    addDateRangeFilter(filters, 'cashback_schedule.payment_date', query?.['search.cashback_schedule.payment_date_from'], query?.['search.cashback_schedule.payment_date_to']);
    addDateRangeFilter(filters, 'cashback_schedule.received_date', query?.['search.cashback_schedule.received_date_from'], query?.['search.cashback_schedule.received_date_to']);
    addDateRangeFilter(filters, 'cashback_schedule.withdral_date', query?.['search.cashback_schedule.withdral_date_from'], query?.['search.cashback_schedule.withdral_date_to']);

    // Apply numeric filter using the helper function
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'placement.base_date', query?.['search.placement.base_date']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'placement.term', query?.['search.placement.term']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'placement.amount', query?.['search.placement.amount']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'interest.rate', query?.['search.interest.rate']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'interest.gross_amount', query?.['search.interest.gross_amount']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'interest.tax_rate', query?.['search.interest.tax_rate']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'interest.tax_amount', query?.['search.interest.tax_amount']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'interest.net_amount', query?.['search.interest.net_amount']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'cashback_schedule.amount', query?.['search.cashback_schedule.amount']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'cashback_schedule.received_amount', query?.['search.cashback_schedule.received_amount']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'cashback_schedule.received_additional_payment_amount', query?.['search.cashback_schedule.received_additional_payment_amount']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'cashback_schedule.amount', query?.['search.cashback_schedule.amount']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'cashback_schedule.received_amount', query?.['search.cashback_schedule.received_amount']);

    // Filter boolean
    BaseMongoDBQueryFilters.addBooleanFilter(filters, 'is_archived', query?.['search.is_archived']);

    BaseMongoDBQueryFilters.addExactFilter(filters, 'status', query?.['search.status']);

    // Custom
    if (query?.['search.cashback_schedule.status'] && query?.['search.cashback_schedule.status'] === 'true') {
      filters.push({ 'cashback_schedule.received_date': { $exists: true, $ne: '' } });
    } else if (query?.['search.cashback_schedule.status'] && query?.['search.cashback_schedule.status'] === 'false') {
      filters.push({ 'cashback_schedule.received_date': { $exists: false } });
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

  private pipeJoinInterestScheduleCreatedBy(): IPipeline[] {
    return [
      {
        $lookup: {
          from: 'users',
          let: {
            userId: '$cashback_schedule.created_by_id',
          },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$_id', '$$userId'] },
              },
            },
            {
              $project: {
                _id: 1,
                email: 1,
                username: 1,
                name: 1,
              },
            },
          ],
          as: 'cashback_schedule.created_by',
        },
      },
      {
        $unwind: {
          path: '$cashback_schedule.created_by',
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
          owner: 1,
          group: 1,
          placement: 1,
          source: 1,
          interest: 1,
          interest_schedule: 1,
          cashback: 1,
          cashback_schedule: 1,
          notes: 1,
          is_archived: 1,
          status: 1,
          created_at: 1,
          created_by: 1,
        },
      },
    ];
  }
}
