import type { IController, IControllerInput } from '@point-hub/papi';

import { AuthorizationService } from '@/modules/_shared/services/authorization.service';

import { InvestmentSummaryRepository } from '../repositories/investment-summary.repository';
import { InvestmentSummaryUseCase } from '../use-cases/investment-summary.use-case';

export const investmentSummaryController: IController = async (controllerInput: IControllerInput) => {
  let session;
  try {
    session = controllerInput.dbConnection.startSession();
    session.startTransaction();

    const investmentSummaryRepository = new InvestmentSummaryRepository(controllerInput.dbConnection);
    const investmentSummaryUseCase = new InvestmentSummaryUseCase({
      investmentSummaryRepository,
      authorizationService: AuthorizationService,
    });

    const response = await investmentSummaryUseCase.handle({
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
