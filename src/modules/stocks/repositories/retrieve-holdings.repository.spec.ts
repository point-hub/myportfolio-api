import type { IDatabase, IQuery } from '@point-hub/papi';
import { describe, expect, it } from 'bun:test';

import { RetrieveHoldingsRepository } from './retrieve-holdings.repository';

const brokers = {
  valbury: { _id: 'broker-valbury', code: 'VALBURY', name: 'Valbury' },
  sinarmas: { _id: 'broker-sinarmas', code: 'SINARMAS', name: 'Sinarmas' },
  maybank: { _id: 'broker-maybank', code: 'MAYBANK', name: 'Maybank' },
};

const issuers = {
  bbca: { _id: 'issuer-bbca', code: 'BBCA', name: 'BCA' },
  bsde: { _id: 'issuer-bsde', code: 'BSDE', name: 'BSDE' },
  ctra: { _id: 'issuer-ctra', code: 'CTRA', name: 'Ciputra' },
};

const stocks = [
  {
    _id: '1',
    transaction_date: '2024-01-01',
    broker_id: brokers.valbury._id,
    broker: brokers.valbury,
    buying_list: [{ issuer_id: issuers.bsde._id, shares: 1000, total: 600000 }],
    selling_list: [],
    buying_issuers: [issuers.bsde],
    selling_issuers: [],
    is_archived: false,
    status: 'active',
  },
  {
    _id: '2',
    transaction_date: '2024-01-02',
    broker_id: brokers.valbury._id,
    broker: brokers.valbury,
    buying_list: [{ issuer_id: issuers.bsde._id, shares: 1000, total: 555000 }],
    selling_list: [],
    buying_issuers: [issuers.bsde],
    selling_issuers: [],
    is_archived: false,
    status: 'active',
  },
  {
    _id: '3',
    transaction_date: '2024-01-03',
    broker_id: brokers.valbury._id,
    broker: brokers.valbury,
    buying_list: [{ issuer_id: issuers.bsde._id, shares: 1000, total: 425000 }],
    selling_list: [],
    buying_issuers: [issuers.bsde],
    selling_issuers: [],
    is_archived: false,
    status: 'active',
  },
  {
    _id: '4',
    transaction_date: '2024-01-04',
    broker_id: brokers.valbury._id,
    broker: brokers.valbury,
    buying_list: [{ issuer_id: issuers.ctra._id, shares: 1000, total: 12500000 }],
    selling_list: [],
    buying_issuers: [issuers.ctra],
    selling_issuers: [],
    is_archived: false,
    status: 'active',
  },
  {
    _id: '5',
    transaction_date: '2024-01-05',
    broker_id: brokers.sinarmas._id,
    broker: brokers.sinarmas,
    buying_list: [{ issuer_id: issuers.bsde._id, shares: 1000, total: 600000 }],
    selling_list: [],
    buying_issuers: [issuers.bsde],
    selling_issuers: [],
    is_archived: false,
    status: 'active',
  },
  {
    _id: '6',
    transaction_date: '2024-01-06',
    broker_id: brokers.maybank._id,
    broker: brokers.maybank,
    buying_list: [{ issuer_id: issuers.bbca._id, shares: 500, total: 450000 }],
    selling_list: [],
    buying_issuers: [issuers.bbca],
    selling_issuers: [],
    is_archived: false,
    status: 'active',
  },
  {
    _id: '7',
    transaction_date: '2024-01-07',
    broker_id: brokers.maybank._id,
    broker: brokers.maybank,
    buying_list: [{ issuer_id: issuers.bbca._id, shares: 315, total: 252000 }],
    selling_list: [],
    buying_issuers: [issuers.bbca],
    selling_issuers: [],
    is_archived: false,
    status: 'active',
  },
  {
    _id: '8',
    transaction_date: '2024-01-08',
    broker_id: brokers.valbury._id,
    broker: brokers.valbury,
    buying_list: [{ issuer_id: issuers.bbca._id, shares: 1000, total: 425000 }],
    selling_list: [],
    buying_issuers: [issuers.bbca],
    selling_issuers: [],
    is_archived: false,
    status: 'active',
  },
  {
    _id: '9',
    transaction_date: '2024-01-09',
    broker_id: brokers.valbury._id,
    broker: brokers.valbury,
    buying_list: [],
    selling_list: [{ issuer_id: issuers.bbca._id, shares: 50, total: 31046.83 }],
    buying_issuers: [],
    selling_issuers: [issuers.bbca],
    is_archived: false,
    status: 'active',
  },
  {
    _id: '10',
    transaction_date: '2024-01-10',
    broker_id: brokers.valbury._id,
    broker: brokers.valbury,
    buying_list: [{ issuer_id: issuers.bbca._id, shares: 100, total: 100000 }],
    selling_list: [],
    buying_issuers: [issuers.bbca],
    selling_issuers: [],
    is_archived: false,
    status: 'active',
  },
  {
    _id: '11',
    transaction_date: '2024-01-11',
    broker_id: brokers.valbury._id,
    broker: brokers.valbury,
    buying_list: [{ issuer_id: issuers.bbca._id, shares: 9000, total: 9000000 }],
    selling_list: [],
    buying_issuers: [issuers.bbca],
    selling_issuers: [],
    is_archived: false,
    status: 'draft',
  },
  {
    _id: '12',
    transaction_date: '2024-01-12',
    broker_id: brokers.valbury._id,
    broker: brokers.valbury,
    buying_list: [{ issuer_id: issuers.bbca._id, shares: 8000, total: 8000000 }],
    selling_list: [],
    buying_issuers: [issuers.bbca],
    selling_issuers: [],
    is_archived: true,
    status: 'active',
  },
];

const getBrokerIdFromPipeline = (pipeline: unknown[]): string | undefined => {
  const firstStage = pipeline[0] as { $match?: { $and?: Record<string, unknown>[] } } | undefined;
  const filters = firstStage?.$match?.$and || [];
  const brokerFilter = filters.find((filter) => 'broker_id' in filter);

  return brokerFilter?.['broker_id'] as string | undefined;
};

const makeRepository = () => {
  const database = {
    collection: () => ({
      aggregate: async (pipeline: unknown[]) => {
        const brokerId = getBrokerIdFromPipeline(pipeline);
        const data = stocks.filter((stock) => {
          return !stock.is_archived
            && stock.status !== 'draft'
            && (!brokerId || stock.broker_id === brokerId);
        });

        return { data };
      },
    }),
  } as unknown as IDatabase;

  return new RetrieveHoldingsRepository(database);
};

describe('RetrieveHoldingsRepository', () => {
  it('calculates holdings across all brokers with selling transactions deducted', async () => {
    const response = await makeRepository().handle({ page: 1, page_size: 10 } as IQuery);

    expect(response.pagination.total_document).toBe(3);
    expect(response.data).toEqual([
      {
        issuer_id: issuers.bbca._id,
        issuer: issuers.bbca,
        number_of_shares: 1865,
        total_buying_price: 1195953.17,
        average_buying_price: 641.26,
      },
      {
        issuer_id: issuers.bsde._id,
        issuer: issuers.bsde,
        number_of_shares: 4000,
        total_buying_price: 2180000,
        average_buying_price: 545,
      },
      {
        issuer_id: issuers.ctra._id,
        issuer: issuers.ctra,
        number_of_shares: 1000,
        total_buying_price: 12500000,
        average_buying_price: 12500,
      },
    ]);
  });

  it('calculates holdings for a specific broker and instrument', async () => {
    const response = await makeRepository().handle({
      page: 1,
      page_size: 10,
      'search.broker_id': brokers.valbury._id,
      'search.issuer_id': issuers.bbca._id,
    } as IQuery);

    expect(response.data).toEqual([
      {
        broker_id: brokers.valbury._id,
        broker: brokers.valbury,
        issuer_id: issuers.bbca._id,
        issuer: issuers.bbca,
        number_of_shares: 1050,
        total_buying_price: 493953.17,
        average_buying_price: 470.43,
      },
    ]);
  });

  it('calculates holdings for another broker after instrument filtering', async () => {
    const response = await makeRepository().handle({
      page: 1,
      page_size: 10,
      'search.broker_id': brokers.maybank._id,
      'search.issuer_id': issuers.bbca._id,
    } as IQuery);

    expect(response.data).toEqual([
      {
        broker_id: brokers.maybank._id,
        broker: brokers.maybank,
        issuer_id: issuers.bbca._id,
        issuer: issuers.bbca,
        number_of_shares: 815,
        total_buying_price: 702000,
        average_buying_price: 861.35,
      },
    ]);
  });
});
