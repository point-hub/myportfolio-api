import { DatabaseTestUtil } from '@point-hub/papi';
import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import type { Express } from 'express';
import request from 'supertest';

import { createApp } from '@/app';
import { type IAuthUserWithTokenResponse, TestService } from '@/modules/_shared/services/test.service';
import DepositFactory from '@/modules/deposits/factory';
import InsuranceFactory from '@/modules/insurances/factory';
import SavingFactory from '@/modules/savings/factory';

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

  it('S.1. succeeds by calculating allocation and return summary', async () => {
    const savingFactory = new SavingFactory(DatabaseTestUtil.dbConnection);
    await savingFactory.state({
      status: 'active',
      is_archived: false,
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

    const depositFactory = new DepositFactory(DatabaseTestUtil.dbConnection);
    await depositFactory.state({
      status: 'active',
      is_archived: false,
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

    const savings = response.body.data.find((item: { type: string }) => item.type === 'savings');
    const deposits = response.body.data.find((item: { type: string }) => item.type === 'deposits');
    const insurances = response.body.data.find((item: { type: string }) => item.type === 'insurances');

    expect(savings.acquisition_value).toStrictEqual(1000);
    expect(savings.weight).toStrictEqual(1000 / 3000 * 100);
    expect(savings.return_in).toStrictEqual(150 / 1000 * 100);

    expect(deposits.acquisition_value).toStrictEqual(2000);
    expect(deposits.weight).toStrictEqual(2000 / 3000 * 100);
    expect(deposits.return_in).toStrictEqual(300 / 2000 * 100);

    expect(insurances.acquisition_value).toStrictEqual(0);
    expect(insurances.gross_interest).toStrictEqual(330);
    expect(insurances.tax).toStrictEqual(30);
    expect(insurances.total_interest).toStrictEqual(300);
    expect(insurances.cashback).toStrictEqual(150);

    expect(response.body.total.acquisition_value).toStrictEqual(3000);
    expect(response.body.total.gross_interest).toStrictEqual(670);
    expect(response.body.total.tax).toStrictEqual(70);
    expect(response.body.total.total_interest).toStrictEqual(600);
    expect(response.body.total.cashback).toStrictEqual(300);
  });
});
