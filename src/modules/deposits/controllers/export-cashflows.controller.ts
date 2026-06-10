import type { IController, IControllerInput } from '@point-hub/papi';

import { AuthorizationService } from '@/modules/_shared/services/authorization.service';

import { ExportCashflowsUseCase } from '../use-cases/export-cashflows.use-case';

export const exportCashflowsController: IController = async (controllerInput: IControllerInput) => {
  const exportCashflowsUseCase = new ExportCashflowsUseCase({
    authorizationService: AuthorizationService,
  });

  const response = await exportCashflowsUseCase.handle({
    authUser: controllerInput.req['authUser'],
    query: controllerInput.req['query'],
  });

  if (response.status === 'failed') {
    controllerInput.res.status(response.error.code);
    controllerInput.res.statusMessage = response.error.message;
    controllerInput.res.json(response.error);
    return;
  }

  controllerInput.res.status(200);
  controllerInput.res.json(response.data);
};
