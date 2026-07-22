import type { IDatabase, IPipeline, IQuery } from '@point-hub/papi';

export type InvestmentType = 'savings' | 'deposits' | 'insurances' | 'stocks' | 'bonds'

export interface IInvestmentSummaryItem {
  type: InvestmentType
  label: string
  acquisition_value: number
  weight: number
  gross_interest: number
  tax: number
  total_interest: number
  cashback: number
  return_in: number
}

export interface IInvestmentSummaryOutput {
  allocation: IInvestmentSummaryItem[]
  data: IInvestmentSummaryItem[]
  total: {
    acquisition_value: number
    weight: number
    gross_interest: number
    tax: number
    total_interest: number
    cashback: number
    return_in: number
  }
}

export interface IInvestmentSummaryRepository {
  handle(query: IQuery): Promise<IInvestmentSummaryOutput>
}

interface IAggregationOutput {
  acquisition_value?: number
  gross_interest?: number
  tax?: number
  total_interest?: number
  cashback?: number
}

const instruments: { type: InvestmentType; label: string; collection: string }[] = [
  { type: 'savings', label: 'Tabungan', collection: 'savings' },
  { type: 'deposits', label: 'Deposito', collection: 'deposits' },
  { type: 'insurances', label: 'Asuransi', collection: 'insurances' },
];

const allocationInstruments: { type: InvestmentType; label: string; collection: string; amountFields: string[]; bankField?: string; groupField?: string }[] = [
  { type: 'savings', label: 'Tabungan', collection: 'savings', amountFields: ['placement.amount'], bankField: 'source.bank_id', groupField: 'group_id' },
  { type: 'deposits', label: 'Deposito', collection: 'deposits', amountFields: ['placement.amount'], bankField: 'source.bank_id', groupField: 'group_id' },
  { type: 'insurances', label: 'Asuransi', collection: 'insurances', amountFields: ['placement.amount'], bankField: 'source.bank_id', groupField: 'group_id' },
  { type: 'stocks', label: 'Saham', collection: 'stocks', amountFields: ['buying_total'] },
  { type: 'bonds', label: 'Obligasi', collection: 'bonds', amountFields: ['principal_amount'], bankField: 'bank_source_id' },
];

export class InvestmentSummaryRepository implements IInvestmentSummaryRepository {
  constructor(
    public database: IDatabase,
    public options?: Record<string, unknown>,
  ) { }

  async handle(query: IQuery): Promise<IInvestmentSummaryOutput> {
    const selectedType = this.getSearchString(query, 'instrument_type');
    const selectedInstruments = instruments.filter((instrument) => !selectedType || instrument.type === selectedType);
    const selectedAllocationInstruments = allocationInstruments.filter((instrument) => !selectedType || instrument.type === selectedType);

    const allocation = await Promise.all(selectedAllocationInstruments.map(async (instrument) => {
      const aggregation = await this.aggregateAllocationInstrument(instrument, query);

      return {
        type: instrument.type,
        label: instrument.label,
        acquisition_value: aggregation.acquisition_value ?? 0,
        weight: 0,
        gross_interest: 0,
        tax: 0,
        total_interest: 0,
        cashback: 0,
        return_in: 0,
      };
    }));

    const totalAllocationValue = allocation.reduce((total, item) => total + item.acquisition_value, 0);
    const mappedAllocation = allocation.map((item) => ({
      ...item,
      weight: totalAllocationValue > 0 ? item.acquisition_value / totalAllocationValue * 100 : 0,
    }));

    const data = await Promise.all(selectedInstruments.map(async (instrument) => {
      const aggregation = await this.aggregateInstrument(instrument.collection, query);

      return {
        type: instrument.type,
        label: instrument.label,
        acquisition_value: aggregation.acquisition_value ?? 0,
        weight: 0,
        gross_interest: aggregation.gross_interest ?? 0,
        tax: aggregation.tax ?? 0,
        total_interest: aggregation.total_interest ?? 0,
        cashback: aggregation.cashback ?? 0,
        return_in: 0,
      };
    }));

    const totalAcquisitionValue = data.reduce((total, item) => total + item.acquisition_value, 0);

    const mappedData = data.map((item) => ({
      ...item,
      weight: totalAcquisitionValue > 0 ? item.acquisition_value / totalAcquisitionValue * 100 : 0,
      return_in: item.acquisition_value > 0 ? (item.total_interest + item.cashback) / item.acquisition_value * 100 : 0,
    }));

    const total = mappedData.reduce((result, item) => {
      result.acquisition_value += item.acquisition_value;
      result.gross_interest += item.gross_interest;
      result.tax += item.tax;
      result.total_interest += item.total_interest;
      result.cashback += item.cashback;
      return result;
    }, {
      acquisition_value: 0,
      weight: totalAcquisitionValue > 0 ? 100 : 0,
      gross_interest: 0,
      tax: 0,
      total_interest: 0,
      cashback: 0,
      return_in: 0,
    });

    total.return_in = total.acquisition_value > 0 ? (total.total_interest + total.cashback) / total.acquisition_value * 100 : 0;

    return {
      allocation: mappedAllocation,
      data: mappedData,
      total,
    };
  }

  private async aggregateAllocationInstrument(
    instrument: { collection: string; amountFields: string[]; bankField?: string; groupField?: string },
    query: IQuery,
  ): Promise<Pick<IAggregationOutput, 'acquisition_value'>> {
    const amountExpression = instrument.amountFields.reduceRight<Record<string, unknown> | number>((fallback, amountField) => ({
      $cond: [
        { $gt: [{ $ifNull: [`$${amountField}`, 0] }, 0] },
        { $ifNull: [`$${amountField}`, 0] },
        fallback,
      ],
    }), 0);

    if (instrument.collection === 'stocks') {
      return await this.aggregateStockHoldingAllocation(query);
    }

    const pipeline: IPipeline[] = [
      ...this.pipeAllocationQueryFilter(query, instrument.bankField, instrument.groupField),
      {
        $group: {
          _id: null,
          acquisition_value: {
            $sum: amountExpression,
          },
        },
      },
      {
        $project: {
          _id: 0,
          acquisition_value: 1,
        },
      },
    ];

    const response = await this.database.collection(instrument.collection).aggregate<Pick<IAggregationOutput, 'acquisition_value'>>(
      pipeline,
      { page: 1, page_size: 1 },
      this.options,
    );

    return response.data[0] ?? {};
  }

  private async aggregateStockHoldingAllocation(query: IQuery): Promise<Pick<IAggregationOutput, 'acquisition_value'>> {
    const pipeline: IPipeline[] = [
      ...this.pipeStockHoldingAllocationQueryFilter(query),
      {
        $project: {
          movements: {
            $cond: [
              {
                $gt: [
                  {
                    $size: {
                      $concatArrays: [
                        { $ifNull: ['$buying_list', []] },
                        { $ifNull: ['$selling_list', []] },
                      ],
                    },
                  },
                  0,
                ],
              },
              {
                $concatArrays: [
                  {
                    $map: {
                      input: { $ifNull: ['$buying_list', []] },
                      as: 'buying',
                      in: {
                        issuer_id: '$$buying.issuer_id',
                        number_of_shares: { $ifNull: ['$$buying.shares', 0] },
                        total_buying_price: { $ifNull: ['$$buying.total', 0] },
                      },
                    },
                  },
                  {
                    $map: {
                      input: { $ifNull: ['$selling_list', []] },
                      as: 'selling',
                      in: {
                        issuer_id: '$$selling.issuer_id',
                        number_of_shares: { $multiply: [{ $ifNull: ['$$selling.shares', 0] }, -1] },
                        total_buying_price: { $multiply: [{ $ifNull: ['$$selling.total', 0] }, -1] },
                      },
                    },
                  },
                ],
              },
              [
                {
                  issuer_id: { $literal: '__legacy_stock_holding__' },
                  number_of_shares: {
                    $cond: [
                      {
                        $gt: [
                          {
                            $subtract: [
                              { $ifNull: ['$buying_total', 0] },
                              { $ifNull: ['$selling_total', 0] },
                            ],
                          },
                          0,
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                  total_buying_price: {
                    $subtract: [
                      { $ifNull: ['$buying_total', 0] },
                      { $ifNull: ['$selling_total', 0] },
                    ],
                  },
                },
              ],
            ],
          },
        },
      },
      { $unwind: '$movements' },
      {
        $group: {
          _id: '$movements.issuer_id',
          number_of_shares: {
            $sum: '$movements.number_of_shares',
          },
          total_buying_price: {
            $sum: '$movements.total_buying_price',
          },
        },
      },
      {
        $match: {
          number_of_shares: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          acquisition_value: {
            $sum: '$total_buying_price',
          },
        },
      },
      {
        $project: {
          _id: 0,
          acquisition_value: 1,
        },
      },
    ];

    const response = await this.database.collection('stocks').aggregate<Pick<IAggregationOutput, 'acquisition_value'>>(
      pipeline,
      { page: 1, page_size: 1 },
      this.options,
    );

    return response.data[0] ?? {};
  }

  private pipeStockHoldingAllocationQueryFilter(query: IQuery): IPipeline[] {
    const filters: Record<string, unknown>[] = [
      { is_archived: false },
      { status: { $ne: 'draft' } },
    ];

    const ownerId = this.getSearchString(query, 'owner_id');
    if (ownerId) {
      filters.push({ owner_id: ownerId });
    }

    const brokerId = this.getSearchString(query, 'broker_id');
    if (brokerId) {
      filters.push({ broker_id: brokerId });
    }

    return [{ $match: { $and: filters } }];
  }

  private async aggregateInstrument(collectionName: string, query: IQuery): Promise<IAggregationOutput> {
    const pipeline: IPipeline[] = [
      ...this.pipeQueryFilter(query),
      {
        $group: {
          _id: null,
          acquisition_value: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'active'] },
                { $ifNull: ['$placement.amount', 0] },
                0,
              ],
            },
          },
          gross_interest: { $sum: { $ifNull: ['$interest.gross_amount', 0] } },
          tax: { $sum: { $ifNull: ['$interest.tax_amount', 0] } },
          total_interest: { $sum: { $ifNull: ['$interest.net_amount', 0] } },
          cashback: {
            $sum: {
              $sum: {
                $map: {
                  input: { $ifNull: ['$cashback_schedule', []] },
                  as: 'cashback',
                  in: { $ifNull: ['$$cashback.amount', 0] },
                },
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          acquisition_value: 1,
          gross_interest: 1,
          tax: 1,
          total_interest: 1,
          cashback: 1,
        },
      },
    ];

    const response = await this.database.collection(collectionName).aggregate<IAggregationOutput>(
      pipeline,
      { page: 1, page_size: 1 },
      this.options,
    );

    return response.data[0] ?? {};
  }

  private pipeQueryFilter(query: IQuery): IPipeline[] {
    const filters: Record<string, unknown>[] = [
      { is_archived: false },
      { status: { $in: ['active', 'renewed'] } },
    ];

    const ownerId = this.getSearchString(query, 'owner_id');
    if (ownerId) {
      filters.push({ owner_id: ownerId });
    }

    const bankId = this.getSearchString(query, 'bank_id');
    if (bankId) {
      filters.push({ 'source.bank_id': bankId });
    }

    const groupId = this.getSearchString(query, 'group_id');
    if (groupId) {
      filters.push({ group_id: groupId });
    }

    return [{ $match: { $and: filters } }];
  }

  private pipeAllocationQueryFilter(query: IQuery, bankField?: string, groupField?: string): IPipeline[] {
    const filters: Record<string, unknown>[] = [
      { is_archived: false },
      { status: 'active' },
    ];

    const ownerId = this.getSearchString(query, 'owner_id');
    if (ownerId) {
      filters.push({ owner_id: ownerId });
    }

    const bankId = this.getSearchString(query, 'bank_id');
    if (bankId) {
      filters.push(bankField ? { [bankField]: bankId } : { _id: { $exists: false } });
    }

    const groupId = this.getSearchString(query, 'group_id');
    if (groupId) {
      filters.push(groupField ? { [groupField]: groupId } : { _id: { $exists: false } });
    }

    return [{ $match: { $and: filters } }];
  }

  private getString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private getSearchString(query: IQuery, field: string): string | undefined {
    const nestedSearch = query['search'] as Record<string, unknown> | undefined;

    return this.getString(query[`search.${field}`]) ??
      this.getString(query[`search[${field}]`]) ??
      this.getString(nestedSearch?.[field]);
  }
}
