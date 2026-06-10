import type { IDatabase, IPagination, IPipeline, IQuery } from '@point-hub/papi';
import { BaseMongoDBQueryFilters } from '@point-hub/papi';

import { addDateRangeFilter } from '@/utils/date-range-filter';

import { collectionName } from '../entity';

export interface ICashflowBankAccount {
  _id?: string
  code?: string
  name?: string
  account?: {
    uuid?: string
    account_number?: string
    account_name?: string
  }
}

export interface ICashflowOutput {
  _id: string
  deposit_id: string
  transaction_type: 'placement' | 'withdrawal' | 'realised-interest'
  transaction_date?: string
  form_number?: string
  investment_type: 'Deposito'
  bank_account?: ICashflowBankAccount
  placement_bank?: ICashflowBankAccount
  description: string
  income: number
  principal_balance: number
  notes?: string
  income_debit: number
  income_credit: number
  income_account?: ICashflowBankAccount
  balance: number
}

export interface IRetrieveCashflowsRepository {
  handle(query: IQuery): Promise<IRetrieveCashflowsOutput>
}

export interface IRetrieveCashflowsOutput {
  data: ICashflowOutput[]
  pagination: IPagination
}

export class RetrieveCashflowsRepository implements IRetrieveCashflowsRepository {
  constructor(
    public database: IDatabase,
    public options?: Record<string, unknown>,
  ) { }

  async handle(query: IQuery): Promise<IRetrieveCashflowsOutput> {
    const pipeline: IPipeline[] = [];

    pipeline.push(...this.pipeBaseFilter());
    pipeline.push(...this.pipeJoinBankId('placement.bank_id', 'placement_bank'));
    pipeline.push(...this.pipeJoinBankAccount('source.bank_id', 'source.bank_account_uuid', 'source_bank'));
    pipeline.push(...this.pipeJoinBankAccount('withdrawal.bank_id', 'withdrawal.bank_account_uuid', 'withdrawal_bank'));
    pipeline.push(...this.pipeJoinBankAccount('interest.bank_id', 'interest.bank_account_uuid', 'interest_bank'));
    pipeline.push(...this.pipeBuildCashflows());
    pipeline.push(...this.pipeFlatCashflows());
    pipeline.push(...this.pipeRootCashflow());
    pipeline.push(...this.pipeQueryFilter(query));

    const response = await this.database.collection(collectionName).aggregate<ICashflowOutput>(pipeline, {
      ...query,
      sort: query.sort || 'transaction_date,form_number',
    }, this.options);

    return {
      data: response.data,
      pagination: response.pagination,
    };
  }

  private pipeBaseFilter(): IPipeline[] {
    return [
      {
        $match: {
          is_archived: false,
          status: { $in: ['active', 'withdrawn', 'renewed'] },
        },
      },
    ];
  }

  private pipeJoinBankId(bankIdPath: string, as: string): IPipeline[] {
    return [
      {
        $lookup: {
          from: 'banks',
          let: { bankId: `$${bankIdPath}` },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$bankId'] } } },
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

  private pipeJoinBankAccount(bankIdPath: string, accountUuidPath: string, as: string): IPipeline[] {
    return [
      {
        $lookup: {
          from: 'banks',
          let: {
            bankId: `$${bankIdPath}`,
            accountUuid: `$${accountUuidPath}`,
          },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$bankId'] } } },
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

  private pipeBuildCashflows(): IPipeline[] {
    return [
      {
        $set: {
          cashflows: {
            $concatArrays: [
              {
                $cond: [
                  { $ne: [{ $ifNull: ['$placement.date', null] }, null] },
                  [{
                    _id: { $concat: [{ $toString: '$_id' }, ':placement'] },
                    deposit_id: { $toString: '$_id' },
                    transaction_type: 'placement',
                    transaction_date: '$placement.date',
                    form_number: '$form_number',
                    investment_type: 'Deposito',
                    bank_account: '$source_bank',
                    placement_bank: '$placement_bank',
                    description: 'Placement',
                    income: 0,
                    principal_balance: { $ifNull: ['$placement.amount', 0] },
                    notes: '$notes',
                    income_debit: 0,
                    income_credit: 0,
                    balance: 0,
                  }],
                  [],
                ],
              },
              {
                $cond: [
                  { $ne: [{ $ifNull: ['$withdrawal.received_date', null] }, null] },
                  [{
                    _id: { $concat: [{ $toString: '$_id' }, ':withdrawal'] },
                    deposit_id: { $toString: '$_id' },
                    transaction_type: 'withdrawal',
                    transaction_date: '$withdrawal.received_date',
                    form_number: '$form_number',
                    investment_type: 'Deposito',
                    bank_account: '$withdrawal_bank',
                    placement_bank: '$placement_bank',
                    description: 'Withdrawal',
                    income: 0,
                    principal_balance: { $multiply: [{ $ifNull: ['$withdrawal.received_amount', 0] }, -1] },
                    notes: '$withdrawal.notes',
                    income_debit: 0,
                    income_credit: 0,
                    balance: 0,
                  }],
                  [],
                ],
              },
              {
                $map: {
                  input: {
                    $filter: {
                      input: { $ifNull: ['$interest_schedule', []] },
                      as: 'interest',
                      cond: { $ne: [{ $ifNull: ['$$interest.received_date', null] }, null] },
                    },
                  },
                  as: 'interest',
                  in: {
                    _id: { $concat: [{ $toString: '$_id' }, ':interest:', { $toString: '$$interest.uuid' }] },
                    deposit_id: { $toString: '$_id' },
                    transaction_type: 'realised-interest',
                    transaction_date: '$$interest.received_date',
                    form_number: '$form_number',
                    investment_type: 'Deposito',
                    bank_account: '$interest_bank',
                    placement_bank: '$placement_bank',
                    description: 'Realised Interest',
                    income: {
                      $add: [
                        { $ifNull: ['$$interest.received_amount', 0] },
                        { $ifNull: ['$$interest.received_additional_payment_amount', 0] },
                      ],
                    },
                    principal_balance: 0,
                    notes: '$notes',
                    income_debit: 0,
                    income_credit: {
                      $add: [
                        { $ifNull: ['$$interest.received_amount', 0] },
                        { $ifNull: ['$$interest.received_additional_payment_amount', 0] },
                      ],
                    },
                    income_account: '$interest_bank',
                    balance: {
                      $add: [
                        { $ifNull: ['$$interest.received_amount', 0] },
                        { $ifNull: ['$$interest.received_additional_payment_amount', 0] },
                      ],
                    },
                  },
                },
              },
            ],
          },
        },
      },
    ];
  }

  private pipeFlatCashflows(): IPipeline[] {
    return [
      {
        $unwind: {
          path: '$cashflows',
          preserveNullAndEmptyArrays: false,
        },
      },
    ];
  }

  private pipeRootCashflow(): IPipeline[] {
    return [
      {
        $replaceRoot: {
          newRoot: '$cashflows',
        },
      },
    ];
  }

  private pipeQueryFilter(query: IQuery): IPipeline[] {
    const filters: Record<string, unknown>[] = [];

    if (query?.['search.all']) {
      const searchRegex = { $regex: query?.['search.all'], $options: 'i' };
      const fields = [
        'form_number',
        'investment_type',
        'bank_account.name',
        'bank_account.account.account_number',
        'bank_account.account.account_name',
        'placement_bank.name',
        'description',
        'notes',
        'income_account.name',
        'income_account.account.account_number',
        'income_account.account.account_name',
      ];
      filters.push({ $or: fields.map((field) => ({ [field]: searchRegex })) });
    }

    BaseMongoDBQueryFilters.addRegexFilter(filters, 'form_number', query?.['search.form_number']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'investment_type', query?.['search.investment_type']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'bank_account.name', query?.['search.bank_account.name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'bank_account.account.account_number', query?.['search.bank_account.account.account_number']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'bank_account.account.account_name', query?.['search.bank_account.account.account_name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'placement_bank.name', query?.['search.placement_bank.name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'description', query?.['search.description']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'notes', query?.['search.notes']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'income_account.name', query?.['search.income_account.name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'income_account.account.account_number', query?.['search.income_account.account.account_number']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'income_account.account.account_name', query?.['search.income_account.account.account_name']);
    BaseMongoDBQueryFilters.addExactFilter(filters, 'transaction_type', query?.['search.transaction_type']);

    addDateRangeFilter(filters, 'transaction_date', query?.['search.transaction_date_from'], query?.['search.transaction_date_to']);

    BaseMongoDBQueryFilters.addNumberFilter(filters, 'income', query?.['search.income']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'principal_balance', query?.['search.principal_balance']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'income_debit', query?.['search.income_debit']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'income_credit', query?.['search.income_credit']);
    BaseMongoDBQueryFilters.addNumberFilter(filters, 'balance', query?.['search.balance']);

    return filters.length > 0 ? [{ $match: { $and: filters } }] : [];
  }
}
