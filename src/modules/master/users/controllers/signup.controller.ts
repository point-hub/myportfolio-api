import type { IController, IControllerInput } from '@point-hub/papi';

import { EmailService } from '@/modules/_shared/services/email.service';
import { SchemaValidationService } from '@/modules/_shared/services/schema-validation.service';
import { UniqueValidationService } from '@/modules/_shared/services/unique-validation.service';
import { AuditLogService } from '@/modules/audit-logs/services/audit-log.service';
import { RetrieveManyRepository as RoleRetrieveManyRepository } from '@/modules/master/roles/repositories/retrieve-many.repository';

import { RetrieveRepository } from '../repositories/retrieve.repository';
import { SignupRepository } from '../repositories/signup.repository';
import { signupRules } from '../rules/signup.rules';
import { EmailVerificationService } from '../services/email-verification.service';
import { PasswordService } from '../services/password.service';
import { SignupUseCase } from '../use-cases/signup.use-case';

export const signupController: IController = async (controllerInput: IControllerInput) => {
  let session;
  try {
    // Start database session for transaction
    session = controllerInput.dbConnection.startSession();
    session.startTransaction();

    // Validate request body against schema
    const schemaValidationResponse = SchemaValidationService.validate(controllerInput.req['body'], signupRules);
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
    const signupRepository = new SignupRepository(controllerInput.dbConnection, { session });
    const retrieveRepository = new RetrieveRepository(controllerInput.dbConnection, { session });
    const roleRetrieveManyRepository = new RoleRetrieveManyRepository(controllerInput.dbConnection, { session });
    const auditLogService = new AuditLogService(controllerInput.dbConnection, { session });
    const uniqueValidationService = new UniqueValidationService(controllerInput.dbConnection, { session });

    // Initialize use case with dependencies
    const signupUseCase = new SignupUseCase({
      signupRepository,
      retrieveRepository,
      roleRetrieveManyRepository,
      auditLogService,
      uniqueValidationService,
      emailService: EmailService,
      emailVerificationService: EmailVerificationService,
      passwordService: PasswordService,
    });

    // Execute business logic
    const response = await signupUseCase.handle({
      userAgent: JSON.parse(
        Array.isArray(controllerInput.req.headers['client-user-agent'])
          ? controllerInput.req.headers['client-user-agent'][0]
          : controllerInput.req.headers['client-user-agent'] ?? '{}',
      ),
      ip: controllerInput.req.ip ?? '',
      data: controllerInput.req['body'],
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
    controllerInput.res.status(201);
    controllerInput.res.json(response.data);
  } catch (error) {
    await session?.abortTransaction();
    throw error;
  } finally {
    await session?.endSession();
  }
};
