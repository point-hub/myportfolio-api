import { DatabaseTestUtil } from '@point-hub/papi';
import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import type { Express } from 'express';
import request from 'supertest';

import { createApp } from '@/app';
import { type IAuthUserWithTokenResponse, TestService } from '@/modules/_shared/services/test.service';
import BondFactory from '@/modules/bonds/factory';
import DepositFactory from '@/modules/deposits/factory';
import InsuranceFactory from '@/modules/insurances/factory';
import SavingFactory from '@/modules/savings/factory';
import StockFactory from '@/modules/stocks/factory';

describe('retrieve investment dashboard summary', async () => {
  let app: Express;
  let authorizedUser: IAuthUserWithTokenResponse;
  let unauthorizedUser: IAuthUserWithTokenResponse;

  beforeAll(async () => {
    app = await createApp({ dbConnection: DatabaseTestUtil.dbConnection });
  });

  beforeEach(async () => {
    await DatabaseTestUtil.reset();

    const testService = new TestService(DatabaseTestUtil.dbConnection);
    authorizedUser = await testService.createAuthUserAndGetAccessToken({
      permissions: ['dashboard:read'],
    });
    unauthorizedUser = await testService.createAuthUserAndGetAccessToken({
      permissions: [],
    });
  }, 20_000);

  it('E.1. fails when user does not have dashboard permission', async () => {
    const response = await request(app)
      .get('/v1/dashboard/investments')
      .set('Authorization', `Bearer ${unauthorizedUser.accessToken}`);

    expect(response.statusCode).toEqual(403);
    expect(response.body.code).toStrictEqual(403);
  });

  it('S.0. succeeds with empty investment data', async () => {
    const response = await request(app)
      .get('/v1/dashboard/investments')
      .set('Authorization', `Bearer ${authorizedUser.accessToken}`);

    expect(response.statusCode).toEqual(200);
    expect(response.body.allocation).toHaveLength(5);
    expect(response.body.data).toHaveLength(3);

    for (const item of response.body.allocation) {
      expect(item.acquisition_value).toStrictEqual(0);
      expect(item.weight).toStrictEqual(0);
    }

    expect(response.body.total.acquisition_value).toStrictEqual(0);
    expect(response.body.total.weight).toStrictEqual(0);
  });

  it('S.1. succeeds by calculating allocation and return summary', async () => {
    const savingFactory = new SavingFactory(DatabaseTestUtil.dbConnection);
    await savingFactory.state({
      status: 'active',
      is_archived: false,
      group_id: 'group-a',
      placement: {
        amount: 1000,
        date: '2026-01-01',
      },
      interest: {
        gross_amount: 120,
        tax_amount: 20,
        net_amount: 100,
      },
      cashback_schedule: [
        { amount: 50 },
      ],
    }).create();
    await savingFactory.state({
      status: 'active',
      is_archived: false,
      group_id: 'group-a',
      placement: {
        amount: 500,
        date: '2030-01-01',
      },
    }).create();

    const depositFactory = new DepositFactory(DatabaseTestUtil.dbConnection);
    await depositFactory.state({
      status: 'active',
      is_archived: false,
      group_id: 'group-a',
      placement: {
        amount: 2000,
        date: '2026-01-01',
      },
      interest: {
        gross_amount: 220,
        tax_amount: 20,
        net_amount: 200,
      },
      cashback_schedule: [
        { amount: 100 },
      ],
    }).create();

    const insuranceFactory = new InsuranceFactory(DatabaseTestUtil.dbConnection);
    await insuranceFactory.state({
      status: 'renewed',
      is_archived: false,
      group_id: 'group-a',
      placement: {
        amount: 3000,
        date: '2026-01-01',
      },
      interest: {
        gross_amount: 330,
        tax_amount: 30,
        net_amount: 300,
      },
      cashback_schedule: [
        { amount: 150 },
      ],
    }).create();

    const stockFactory = new StockFactory(DatabaseTestUtil.dbConnection);
    await stockFactory.state({
      status: 'active',
      is_archived: false,
      transaction_date: '2026-01-01',
      proceed_amount: 5000,
      buying_proceed: 4500,
      buying_total: 4000,
    }).create();

    const response = await request(app)
      .get('/v1/dashboard/investments')
      .set('Authorization', `Bearer ${authorizedUser.accessToken}`)
      .query({
        search: {
          date_from: '2026-01-01',
          date_to: '2026-12-31',
        },
      });

    expect(response.statusCode).toEqual(200);
    expect(response.body.data).toHaveLength(3);
    expect(response.body.allocation).toHaveLength(5);

    const savings = response.body.data.find((item: { type: string }) => item.type === 'savings');
    const deposits = response.body.data.find((item: { type: string }) => item.type === 'deposits');
    const insurances = response.body.data.find((item: { type: string }) => item.type === 'insurances');
    const stockAllocation = response.body.allocation.find((item: { type: string }) => item.type === 'stocks');

    expect(savings.acquisition_value).toStrictEqual(1500);
    expect(savings.weight).toStrictEqual(1500 / 3500 * 100);
    expect(savings.return_in).toStrictEqual(150 / 1500 * 100);

    expect(deposits.acquisition_value).toStrictEqual(2000);
    expect(deposits.weight).toStrictEqual(2000 / 3500 * 100);
    expect(deposits.return_in).toStrictEqual(300 / 2000 * 100);

    expect(insurances.acquisition_value).toStrictEqual(0);
    expect(insurances.gross_interest).toStrictEqual(330);
    expect(insurances.tax).toStrictEqual(30);
    expect(insurances.total_interest).toStrictEqual(300);
    expect(insurances.cashback).toStrictEqual(150);

    expect(stockAllocation.acquisition_value).toStrictEqual(4000);
    expect(stockAllocation.weight).toStrictEqual(4000 / 7500 * 100);

    expect(response.body.total.acquisition_value).toStrictEqual(3500);
    expect(response.body.total.gross_interest).toStrictEqual(670);
    expect(response.body.total.tax).toStrictEqual(70);
    expect(response.body.total.total_interest).toStrictEqual(600);
    expect(response.body.total.cashback).toStrictEqual(300);
  });

  it('S.2. succeeds by filtering summary by group', async () => {
    const savingFactory = new SavingFactory(DatabaseTestUtil.dbConnection);
    await savingFactory.state({
      status: 'active',
      is_archived: false,
      group_id: 'group-a',
      placement: {
        amount: 1000,
        date: '2026-01-01',
      },
    }).create();
    await savingFactory.state({
      status: 'active',
      is_archived: false,
      group_id: 'group-b',
      placement: {
        amount: 2000,
        date: '2026-01-01',
      },
    }).create();

    const response = await request(app)
      .get('/v1/dashboard/investments')
      .set('Authorization', `Bearer ${authorizedUser.accessToken}`)
      .query({
        search: {
          group_id: 'group-a',
        },
      });

    expect(response.statusCode).toEqual(200);

    const savings = response.body.data.find((item: { type: string }) => item.type === 'savings');
    const savingAllocation = response.body.allocation.find((item: { type: string }) => item.type === 'savings');

    expect(savings.acquisition_value).toStrictEqual(1000);
    expect(savingAllocation.acquisition_value).toStrictEqual(1000);
    expect(response.body.total.acquisition_value).toStrictEqual(1000);
  });

  it('S.3. succeeds by calculating bond allocation from principal amount', async () => {
    const bondFactory = new BondFactory(DatabaseTestUtil.dbConnection);
    await bondFactory.state({
      status: 'active',
      is_archived: false,
      principal_amount: 2600,
      remaining_amount: 1600,
    }).create();

    const response = await request(app)
      .get('/v1/dashboard/investments')
      .set('Authorization', `Bearer ${authorizedUser.accessToken}`);

    expect(response.statusCode).toEqual(200);

    const bondAllocation = response.body.allocation.find((item: { type: string }) => item.type === 'bonds');

    expect(bondAllocation.acquisition_value).toStrictEqual(2600);
    expect(bondAllocation.weight).toStrictEqual(100);
  });

  it('S.4. succeeds by calculating portfolio allocation from simulation data', async () => {
    const depositFactory = new DepositFactory(DatabaseTestUtil.dbConnection);
    for (const amount of [10_000_000, 2_400_000, 51_000_000, 67_000_000, 100_000_000]) {
      await depositFactory.state({
        status: 'active',
        is_archived: false,
        placement: { amount },
      }).create();
    }

    const savingFactory = new SavingFactory(DatabaseTestUtil.dbConnection);
    for (const amount of [67_000_000, 2_400_000, 51_000_000, 67_000_000, 16_000_000]) {
      await savingFactory.state({
        status: 'active',
        is_archived: false,
        placement: { amount },
      }).create();
    }

    const insuranceFactory = new InsuranceFactory(DatabaseTestUtil.dbConnection);
    for (const amount of [90_000_000, 2_400_000, 51_000_000, 250_000_000, 15_000_000]) {
      await insuranceFactory.state({
        status: 'active',
        is_archived: false,
        placement: { amount },
      }).create();
    }

    const bondFactory = new BondFactory(DatabaseTestUtil.dbConnection);
    for (const principalAmount of [100_000_000, 15_000_000, 160_000_000, 17_000_000, 180_000_000]) {
      await bondFactory.state({
        status: 'active',
        is_archived: false,
        principal_amount: principalAmount,
        remaining_amount: 0,
      }).create();
    }

    const stockFactory = new StockFactory(DatabaseTestUtil.dbConnection);
    for (const buyingTotal of [100_000_000, 230_000_000, 430_000_000, 100_000_000, 600_000_000]) {
      await stockFactory.state({
        status: 'active',
        is_archived: false,
        proceed_amount: 0,
        buying_proceed: 0,
        buying_total: buyingTotal,
      }).create();
    }

    const response = await request(app)
      .get('/v1/dashboard/investments')
      .set('Authorization', `Bearer ${authorizedUser.accessToken}`);

    expect(response.statusCode).toEqual(200);

    const allocationByType = Object.fromEntries(
      response.body.allocation.map((item: { type: string; acquisition_value: number; weight: number }) => [item.type, item]),
    );

    expect(allocationByType.deposits.acquisition_value).toStrictEqual(230_400_000);
    expect(allocationByType.savings.acquisition_value).toStrictEqual(203_400_000);
    expect(allocationByType.insurances.acquisition_value).toStrictEqual(408_400_000);
    expect(allocationByType.bonds.acquisition_value).toStrictEqual(472_000_000);
    expect(allocationByType.stocks.acquisition_value).toStrictEqual(1_460_000_000);

    expect(allocationByType.deposits.weight).toBeCloseTo(8.31, 2);
    expect(allocationByType.savings.weight).toBeCloseTo(7.33, 2);
    expect(allocationByType.insurances.weight).toBeCloseTo(14.72, 2);
    expect(allocationByType.bonds.weight).toBeCloseTo(17.01, 2);
    expect(allocationByType.stocks.weight).toBeCloseTo(52.63, 2);
  });
});
