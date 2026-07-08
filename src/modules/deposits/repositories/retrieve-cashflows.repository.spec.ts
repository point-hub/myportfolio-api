import { DatabaseTestUtil } from '@point-hub/papi';
import { beforeEach, describe, expect, it } from 'bun:test';

import DepositFactory from '../factory';
import { RetrieveCashflowsRepository } from './retrieve-cashflows.repository';

describe('retrieve deposit cashflows repository', () => {
  beforeEach(async () => {
    await DatabaseTestUtil.reset();
  });

  it('calculates principal and income debit credit with running balances', async () => {
    const depositFactory = new DepositFactory(DatabaseTestUtil.dbConnection);
    await depositFactory.state({
      form_number: 'DEPO/00001/202606',
      status: 'withdrawn',
      is_archived: false,
      placement: {
        date: '2026-06-01',
        amount: 1000000,
      },
      withdrawal: {
        received_date: '2026-06-20',
        received_amount: 400000,
        additional_received_amount: 100000,
        notes: 'Partial principal withdrawal',
      },
      interest_schedule: [
        {
          uuid: 'interest-1',
          payment_date: '2026-06-10',
          amount: 100000,
          received_date: '2026-06-10',
          received_amount: 80000,
          received_additional_payment_amount: 5000,
        },
      ],
      notes: 'Placement notes',
    }).create();

    const repository = new RetrieveCashflowsRepository(DatabaseTestUtil.dbConnection);
    const response = await repository.handle({
      page: 1,
      page_size: 10,
      sort: 'transaction_date,form_number',
    });

    expect(response.data).toHaveLength(3);

    expect(response.data.map(item => item.transaction_type)).toEqual([
      'placement',
      'realised-interest',
      'withdrawal',
    ]);

    expect(response.data[0]).toMatchObject({
      principal_debit: 1000000,
      principal_credit: 0,
      principal_balance: 1000000,
      income_debit: 0,
      income_credit: 0,
      balance: 0,
    });

    expect(response.data[1]).toMatchObject({
      principal_debit: 0,
      principal_credit: 0,
      principal_balance: 1000000,
      income: 85000,
      income_debit: 85000,
      income_credit: 0,
      balance: 85000,
    });

    expect(response.data[2]).toMatchObject({
      principal_debit: 0,
      principal_credit: 500000,
      principal_balance: 500000,
      income_debit: 0,
      income_credit: 0,
      balance: 85000,
    });
  });
});
