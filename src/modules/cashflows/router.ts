import { Router } from 'express';

import type { IBaseAppInput } from '@/app';
import { makeController, makeMiddleware } from '@/express';
import { authMiddleware } from '@/middlewares/auth.middleware';
import type { IRoute } from '@/router';

import {
  downloadCashflowsExportController,
  exportCashflowsController,
  retrieveCashflowsController,
} from '../deposits/controllers/index';

const makeRouter = async ({ dbConnection }: IBaseAppInput) => {
  const router = Router();

  const routes: IRoute[] = [
    { method: 'get', path: '/', middlewares: [authMiddleware], controller: retrieveCashflowsController },
    { method: 'get', path: '/export', middlewares: [authMiddleware], controller: exportCashflowsController },
    { method: 'get', path: '/export-download', middlewares: [authMiddleware], controller: downloadCashflowsExportController },
  ];

  routes.forEach(({ method, path, controller, middlewares }) => {
    const middlewareFns = middlewares?.map((middleware) => makeMiddleware({ middleware, dbConnection })) ?? [];
    router[method](path, ...middlewareFns, makeController({ controller, dbConnection }));
  });

  return router;
};

export default makeRouter;
