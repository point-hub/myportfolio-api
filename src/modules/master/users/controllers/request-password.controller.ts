import type { IController, IControllerInput } from '@point-hub/papi';

import { EmailService } from '@/modules/_shared/services/email.service';
import { SchemaValidationService } from '@/modules/_shared/services/schema-validation.service';
import { AuditLogService } from '@/modules/audit-logs/services/audit-log.service';

import { IdentityMatcherRepository } from '../repositories/identity-matcher.repository';
import { RetrieveRepository } from '../repositories/retrieve.repository';
import { UpdateRepository } from '../repositories/update.repository';
import { requestPasswordRules } from '../rules/request-password.rules';
import { ResetPasswordService } from '../services/reset-password.service';
import { RequestPasswordUseCase } from '../use-cases/request-password.use-case';

export const requestPasswordController: IController = async (controllerInput: IControllerInput) => {
  let session;
  try {
    // Start database session for transaction
    session = controllerInput.dbConnection.startSession();
    session.startTransaction();

    // Validate request body against schema
    const schemaValidationResponse = SchemaValidationService.validate(controllerInput.req['body'], requestPasswordRules);
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
    const identityMatcherRepository = new IdentityMatcherRepository(controllerInput.dbConnection, { session });
    const updateRepository = new UpdateRepository(controllerInput.dbConnection, { session });
    const retrieveRepository = new RetrieveRepository(controllerInput.dbConnection, { session });
    const auditLogService = new AuditLogService(controllerInput.dbConnection, { session });

    // Initialize use case with dependencies
    const requestPasswordUseCase = new RequestPasswordUseCase({
      identityMatcherRepository,
      retrieveRepository,
      updateRepository,
      auditLogService,
      emailService: EmailService,
      resetPasswordService: ResetPasswordService,
    });

    // Execute business logic
    const response = await requestPasswordUseCase.handle({
      userAgent: JSON.parse(
        Array.isArray(controllerInput.req.headers['client-user-agent'])
          ? controllerInput.req.headers['client-user-agent'][0]
          : controllerInput.req.headers['client-user-agent'] ?? '{}',
      ),
      ip: controllerInput.req.ip ?? '',
      data: {
        email: controllerInput.req['body']['email'],
      },
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
    controllerInput.res.json();
  } catch (error) {
    await session?.abortTransaction();
    throw error;
  } finally {
    await session?.endSession();
  }
};
