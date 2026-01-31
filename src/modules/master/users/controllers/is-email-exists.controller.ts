import { type IController, type IControllerInput } from '@point-hub/papi';

import { SchemaValidationService } from '@/modules/_shared/services/schema-validation.service';

import { IsEmailExistsRepository } from '../repositories/is-email-exists.repository';
import { isEmailExistsRules } from '../rules/is-email-exists.rules';
import { IsEmailExistsUseCase } from '../use-cases/is-email-exists.use-case';

export const isEmailExistsController: IController = async (controllerInput: IControllerInput) => {
  let session;
  try {
    // Start database session for transaction
    session = controllerInput.dbConnection.startSession();
    session.startTransaction();

    // Validate request body against schema
    const schemaValidationResponse = SchemaValidationService.validate(controllerInput.req['body'], isEmailExistsRules);
    if (schemaValidationResponse) {
      controllerInput.res.status(schemaValidationResponse.code);
      controllerInput.res.statusMessage = schemaValidationResponse.message;
      controllerInput.res.json({
        code: 422,
        message: schemaValidationResponse.message,
        errors: schemaValidationResponse.errors,
      });
      return;
    }

    // Initialize repositories and utilities
    const isEmailExistsRepository = new IsEmailExistsRepository(controllerInput.dbConnection, {
      session,
    });

    // Initialize use case with dependencies
    const isEmailExistsUseCase = new IsEmailExistsUseCase({
      isEmailExistsRepository,
    });

    // Execute business logic
    const response = await isEmailExistsUseCase.handle(controllerInput.req['body']);

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
