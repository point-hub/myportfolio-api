import { Router } from 'express';

import type { IBaseAppInput } from '@/app';
import { makeController, makeMiddleware } from '@/express';
import { authMiddleware } from '@/middlewares/auth.middleware';
import type { IRoute } from '@/router';

import * as controller from './controllers/index';

const makeRouter = async ({ dbConnection }: IBaseAppInput) => {
  const router = Router();

  const routes: IRoute[] = [
    { method: 'post', path: '/draft', middlewares: [authMiddleware], controller: controller.draftController },
    { method: 'post', path: '/', middlewares: [authMiddleware], controller: controller.createController },
    { method: 'get', path: '/', middlewares: [authMiddleware], controller: controller.retrieveManyController },
    { method: 'get', path: '/interests', middlewares: [authMiddleware], controller: controller.retrieveInterestsController },
    { method: 'get', path: '/cashbacks', middlewares: [authMiddleware], controller: controller.retrieveCashbacksController },
    { method: 'get', path: '/:id', middlewares: [authMiddleware], controller: controller.retrieveController },
    { method: 'patch', path: '/:id', middlewares: [authMiddleware], controller: controller.updateController },
    { method: 'patch', path: '/:id/draft', middlewares: [authMiddleware], controller: controller.updateDraftController },
    { method: 'post', path: '/:id/receive-interest', middlewares: [authMiddleware], controller: controller.receiveInterestController },
    { method: 'post', path: '/:id/receive-cashback', middlewares: [authMiddleware], controller: controller.receiveCashbackController },
    { method: 'post', path: '/:id/archive', middlewares: [authMiddleware], controller: controller.archiveController },
    { method: 'post', path: '/:id/restore', middlewares: [authMiddleware], controller: controller.restoreController },
    { method: 'post', path: '/:id/withdrawal', middlewares: [authMiddleware], controller: controller.withdrawalController },
    { method: 'delete', path: '/:id', middlewares: [authMiddleware], controller: controller.deleteController },
  ];

  routes.forEach(({ method, path, controller, middlewares }) => {
    const middlewareFns = middlewares?.map((middleware) => makeMiddleware({ middleware, dbConnection })) ?? [];
    router[method](path, ...middlewareFns, makeController({ controller, dbConnection }));
  });

  return router;
};

export default makeRouter;
