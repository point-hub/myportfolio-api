import type { IDatabase, IPipeline, IQuery } from '@point-hub/papi';

import { addDateRangeFilter } from '@/utils/date-range-filter';

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

const allocationInstruments: { type: InvestmentType; label: string; collection: string; amountField: string; dateField: string; bankField?: string; bankAccountField?: string }[] = [
  { type: 'savings', label: 'Tabungan', collection: 'savings', amountField: 'placement.amount', dateField: 'placement.date', bankField: 'source.bank_id', bankAccountField: 'source.bank_account_uuid' },
  { type: 'deposits', label: 'Deposito', collection: 'deposits', amountField: 'placement.amount', dateField: 'placement.date', bankField: 'source.bank_id', bankAccountField: 'source.bank_account_uuid' },
  { type: 'insurances', label: 'Asuransi', collection: 'insurances', amountField: 'placement.amount', dateField: 'placement.date', bankField: 'source.bank_id', bankAccountField: 'source.bank_account_uuid' },
  { type: 'stocks', label: 'Saham', collection: 'stocks', amountField: 'buying_proceed', dateField: 'transaction_date' },
  { type: 'bonds', label: 'Obligasi', collection: 'bonds', amountField: 'principal_amount', dateField: 'transaction_date', bankField: 'bank_source_id', bankAccountField: 'bank_source_account_uuid' },
];

export class InvestmentSummaryRepository implements IInvestmentSummaryRepository {
  constructor(
    public database: IDatabase,
    public options?: Record<string, unknown>,
  ) { }

  async handle(query: IQuery): Promise<IInvestmentSummaryOutput> {
    const selectedType = this.getString(query['search.instrument_type']);
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
    instrument: { collection: string; amountField: string; dateField: string; bankField?: string; bankAccountField?: string },
    query: IQuery,
  ): Promise<Pick<IAggregationOutput, 'acquisition_value'>> {
    const pipeline: IPipeline[] = [
      ...this.pipeAllocationQueryFilter(query, instrument.dateField, instrument.bankField, instrument.bankAccountField),
      {
        $group: {
          _id: null,
          acquisition_value: {
            $sum: { $ifNull: [`$${instrument.amountField}`, 0] },
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

    const ownerId = this.getString(query['search.owner_id']);
    if (ownerId) {
      filters.push({ owner_id: ownerId });
    }

    const bankId = this.getString(query['search.bank_id']);
    if (bankId) {
      filters.push({ 'source.bank_id': bankId });
    }

    const bankAccountUuid = this.getString(query['search.bank_account_uuid']);
    if (bankAccountUuid) {
      filters.push({ 'source.bank_account_uuid': bankAccountUuid });
    }

    addDateRangeFilter(
      filters,
      'placement.date',
      this.getString(query['search.date_from']),
      this.getString(query['search.date_to']) || new Date().toISOString().substring(0, 10),
    );

    return [{ $match: { $and: filters } }];
  }

  private pipeAllocationQueryFilter(query: IQuery, dateField: string, bankField?: string, bankAccountField?: string): IPipeline[] {
    const filters: Record<string, unknown>[] = [
      { is_archived: false },
      { status: 'active' },
    ];

    const ownerId = this.getString(query['search.owner_id']);
    if (ownerId) {
      filters.push({ owner_id: ownerId });
    }

    const bankId = this.getString(query['search.bank_id']);
    if (bankId) {
      filters.push(bankField ? { [bankField]: bankId } : { _id: { $exists: false } });
    }

    const bankAccountUuid = this.getString(query['search.bank_account_uuid']);
    if (bankAccountUuid) {
      filters.push(bankAccountField ? { [bankAccountField]: bankAccountUuid } : { _id: { $exists: false } });
    }

    addDateRangeFilter(
      filters,
      dateField,
      this.getString(query['search.date_from']),
      this.getString(query['search.date_to']) || new Date().toISOString().substring(0, 10),
    );

    return [{ $match: { $and: filters } }];
  }

  private getString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
