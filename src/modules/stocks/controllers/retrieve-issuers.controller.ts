import type { IController, IControllerInput } from '@point-hub/papi';

import { AuthorizationService } from '@/modules/_shared/services/authorization.service';

import { RetrieveIssuersRepository } from '../repositories/retrieve-issuers.repository';
import { RetrieveIssuersUseCase } from '../use-cases/retrieve-issuers.use-case';

export const retrieveIssuersController: IController = async (controllerInput: IControllerInput) => {
  let session;
  try {
    // Start database session for transaction
    session = controllerInput.dbConnection.startSession();
    session.startTransaction();

    // Initialize repositories and utilities
    const retrieveIssuersRepository = new RetrieveIssuersRepository(controllerInput.dbConnection);

    // Initialize use case with dependencies
    const retrieveIssuersUseCase = new RetrieveIssuersUseCase({
      retrieveIssuersRepository,
      authorizationService: AuthorizationService,
    });

    // Execute business logic
    const response = await retrieveIssuersUseCase.handle({
      authUser: controllerInput.req['authUser'],
      query: controllerInput.req['query'],
    });

    // Handle failed response
    if (response.status === 'failed') {
      controllerInput.res.status(response.error.code);
      controllerInput.res.statusMessage = response.error.message;
      controllerInput.res.json(response.error);
      return;
    }
    // Commit transaction and send response
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
