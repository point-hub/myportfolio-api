import type { IController, IControllerInput } from '@point-hub/papi';

import { AuthorizationService } from '@/modules/_shared/services/authorization.service';

import { RetrieveCashflowsRepository } from '../repositories/retrieve-cashflows.repository';
import { RetrieveCashflowsUseCase } from '../use-cases/retrieve-cashflows.use-case';

export const retrieveCashflowsController: IController = async (controllerInput: IControllerInput) => {
  let session;
  try {
    session = controllerInput.dbConnection.startSession();
    session.startTransaction();

    const retrieveCashflowsRepository = new RetrieveCashflowsRepository(controllerInput.dbConnection);
    const retrieveCashflowsUseCase = new RetrieveCashflowsUseCase({
      retrieveCashflowsRepository,
      authorizationService: AuthorizationService,
    });

    const response = await retrieveCashflowsUseCase.handle({
      authUser: controllerInput.req['authUser'],
      query: controllerInput.req['query'],
    });

    if (response.status === 'failed') {
      controllerInput.res.status(response.error.code);
      controllerInput.res.statusMessage = response.error.message;
      controllerInput.res.json(response.error);
      return;
    }

    await session.commitTransaction();
    controllerInput.res.status(200);
    controllerInput.res.json(response.data);
  } catch (error) {
    await session?.abortTransaction();
    throw error;
  } finally {
    await session?.endSession();
  }
};
