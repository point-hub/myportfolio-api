import type { IDatabase, IPagination, IPipeline, IQuery } from '@point-hub/papi';

import type { IBroker } from '@/modules/master/brokers/interface';
import type { IIssuer } from '@/modules/master/issuers/interface';
import { addDateRangeFilter } from '@/utils/date-range-filter';

import { collectionName } from '../entity';
import type { IStock } from '../interface';

export interface IStockHolding {
  issuer_id?: string
  issuer?: Pick<IIssuer, '_id' | 'code' | 'name'>
  broker_id?: string
  broker?: Pick<IBroker, '_id' | 'code' | 'name'>
  number_of_shares: number
  total_buying_price: number
  average_buying_price: number
}

export interface IRetrieveHoldingsOutput {
  data: IStockHolding[]
  pagination: IPagination
}

interface IStockWithRelations extends IStock {
  broker?: Pick<IBroker, '_id' | 'code' | 'name'>
  buying_issuers?: Pick<IIssuer, '_id' | 'code' | 'name'>[]
  selling_issuers?: Pick<IIssuer, '_id' | 'code' | 'name'>[]
}

interface IHoldingState extends IStockHolding {
  total_buying_price: number
  number_of_shares: number
}

export interface IRetrieveHoldingsRepository {
  handle(query: IQuery): Promise<IRetrieveHoldingsOutput>
}

export class RetrieveHoldingsRepository implements IRetrieveHoldingsRepository {
  constructor(
    public database: IDatabase,
    public options?: Record<string, unknown>,
  ) { }

  async handle(query: IQuery): Promise<IRetrieveHoldingsOutput> {
    const pipeline: IPipeline[] = [
      ...this.pipeQueryFilter(query),
      ...this.pipeJoinBrokerId(),
      ...this.pipeJoinIssuers('buying_list.issuer_id', 'buying_issuers'),
      ...this.pipeJoinIssuers('selling_list.issuer_id', 'selling_issuers'),
      { $sort: { transaction_date: 1, _id: 1 } },
      ...this.pipeProject(),
    ];

    const response = await this.database.collection(collectionName).aggregate<IStockWithRelations>(
      pipeline,
      { page: 1, page_size: 100000 },
      this.options,
    );

    const holdings = this.calculateHoldings(response.data, query);
    const page = Number(query.page || 1);
    const pageSize = Number(query.page_size || 10);
    const start = (page - 1) * pageSize;

    return {
      data: holdings.slice(start, start + pageSize),
      pagination: {
        page,
        page_count: Math.ceil(holdings.length / pageSize) || 1,
        page_size: pageSize,
        total_document: holdings.length,
      },
    };
  }

  private calculateHoldings(stocks: IStockWithRelations[], query: IQuery): IStockHolding[] {
    const holdings = new Map<string, IHoldingState>();
    const issuerFilter = query?.['search.issuer_id'];
    const isBrokerSpecific = Boolean(query?.['search.broker_id']);

    for (const stock of stocks) {
      const broker = stock.broker;

      for (const item of stock.buying_list || []) {
        if (!item.issuer_id || (issuerFilter && item.issuer_id !== issuerFilter)) continue;

        const issuer = stock.buying_issuers?.find((data) => data._id === item.issuer_id);
        const key = this.getHoldingKey(isBrokerSpecific ? stock.broker_id : undefined, item.issuer_id);
        const holding = holdings.get(key) || {
          broker_id: isBrokerSpecific ? stock.broker_id : undefined,
          broker: isBrokerSpecific ? broker : undefined,
          issuer_id: item.issuer_id,
          issuer,
          number_of_shares: 0,
          total_buying_price: 0,
          average_buying_price: 0,
        };

        holding.number_of_shares += Number(item.shares || 0);
        holding.total_buying_price += Number(item.total || 0);
        holding.average_buying_price = this.getAverageBuyingPrice(holding);
        holdings.set(key, holding);
      }

      for (const item of stock.selling_list || []) {
        if (!item.issuer_id || (issuerFilter && item.issuer_id !== issuerFilter)) continue;

        const key = this.getHoldingKey(isBrokerSpecific ? stock.broker_id : undefined, item.issuer_id);
        const issuer = stock.selling_issuers?.find((data) => data._id === item.issuer_id);
        const holding = holdings.get(key) || {
          broker_id: isBrokerSpecific ? stock.broker_id : undefined,
          broker: isBrokerSpecific ? broker : undefined,
          issuer_id: item.issuer_id,
          issuer,
          number_of_shares: 0,
          total_buying_price: 0,
          average_buying_price: 0,
        };
        const soldShares = Number(item.shares || 0);
        const soldTotal = Number(item.total || 0);

        holding.number_of_shares -= soldShares;
        holding.total_buying_price -= soldTotal;
        holding.average_buying_price = this.getAverageBuyingPrice(holding);
        holdings.set(key, holding);
      }
    }

    return Array.from(holdings.values())
      .filter((holding) => holding.number_of_shares > 0)
      .map((holding) => ({
        ...holding,
        number_of_shares: this.round(holding.number_of_shares),
        total_buying_price: this.round(holding.total_buying_price),
        average_buying_price: this.round(holding.average_buying_price),
      }))
      .sort((a, b) => `${a.issuer?.code || ''}${a.broker?.name || ''}`.localeCompare(`${b.issuer?.code || ''}${b.broker?.name || ''}`));
  }

  private getAverageBuyingPrice(holding: IHoldingState): number {
    if (!holding.number_of_shares) return 0;
    return holding.total_buying_price / holding.number_of_shares;
  }

  private getHoldingKey(brokerId?: string, issuerId?: string): string {
    return `${brokerId || '-'}:${issuerId || '-'}`;
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private pipeQueryFilter(query: IQuery): IPipeline[] {
    const filters: Record<string, unknown>[] = [
      { is_archived: false },
      { status: { $ne: 'draft' } },
    ];

    addDateRangeFilter(filters, 'transaction_date', query?.['search.transaction_date_from'], query?.['search.transaction_date_to']);

    if (query?.['search.broker_id']) {
      filters.push({ broker_id: query?.['search.broker_id'] });
    }

    return [{ $match: { $and: filters } }];
  }

  private pipeJoinBrokerId(): IPipeline[] {
    return [
      {
        $lookup: {
          from: 'brokers',
          let: { brokerId: '$broker_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$brokerId'] } } },
            { $project: { _id: 1, code: 1, name: 1 } },
          ],
          as: 'broker',
        },
      },
      { $unwind: { path: '$broker', preserveNullAndEmptyArrays: true } },
    ];
  }

  private pipeJoinIssuers(localField: string, as: string): IPipeline[] {
    return [
      {
        $lookup: {
          from: 'issuers',
          localField,
          foreignField: '_id',
          pipeline: [
            { $project: { _id: 1, code: 1, name: 1 } },
          ],
          as,
        },
      },
    ];
  }

  private pipeProject(): IPipeline[] {
    return [
      {
        $project: {
          transaction_date: 1,
          broker_id: 1,
          broker: 1,
          buying_list: 1,
          selling_list: 1,
          buying_issuers: 1,
          selling_issuers: 1,
        },
      },
    ];
  }
}
