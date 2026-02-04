import { BaseUseCase, type IUseCaseOutputFailed, type IUseCaseOutputSuccess } from '@point-hub/papi';

import type { IAuthorizationService } from '@/modules/_shared/services/authorization.service';
import type { IUniqueValidationService } from '@/modules/_shared/services/unique-validation.service';
import type { IUserAgent } from '@/modules/_shared/types/user-agent.type';
import type { IAblyService } from '@/modules/ably/services/ably.service';
import type { IAuditLogService } from '@/modules/audit-logs/services/audit-log.service';
import type { ICodeGeneratorService } from '@/modules/counters/services/code-generator.service';
import type { IAuthUser } from '@/modules/master/users/interface';
import { roundNumber } from '@/utils/number';

import { collectionName, InsuranceEntity } from '../entity';
import type { ICreateRepository } from '../repositories/create.repository';
import type { IRetrieveRepository } from '../repositories/retrieve.repository';
import type { IUpdateRepository } from '../repositories/update.repository';

export interface IInput {
  ip: string
  authUser: IAuthUser
  userAgent: IUserAgent
  filter: {
    _id: string
  }
  data: {
    form_number?: string
    owner_id?: string
    group_id?: string
    placement?: {
      bank_id?: string
      policy_number?: string
      base_date?: number
      date?: string
      term?: number
      maturity_date?: string
      amount?: number
    }
    source?: {
      bank_id?: string
      bank_account_uuid?: string
    }
    interest?: {
      payment_method?: string
      rate?: number
      gross_amount?: number
      tax_rate?: number
      tax_amount?: number
      net_amount?: number
      bank_id?: string
      bank_account_uuid?: string
      is_rollover?: boolean
    }
    interest_schedule?: {
      term?: number
      payment_date?: string
      amount?: number
    }[]
    cashback?: {
      bank_id?: string
      bank_account_uuid?: string
    }
    cashback_schedule?: {
      payment_date?: string
      rate?: number
      amount?: number
    }[]
    notes?: string | null | undefined
  }
}

export interface IDeps {
  createRepository: ICreateRepository
  updateRepository: IUpdateRepository
  retrieveRepository: IRetrieveRepository
  ablyService: IAblyService
  auditLogService: IAuditLogService
  authorizationService: IAuthorizationService
  codeGeneratorService: ICodeGeneratorService
  uniqueValidationService: IUniqueValidationService
}

export interface ISuccessData {
  inserted_id: string
}

/**
 * Use case: Create Insurance.
 *
 * Responsibilities:
 * - Check whether the user is authorized to perform this action.
 * - Normalizes data (trim).
 * - Check the insterest schedule amount should match with interest net amount.
 * - Validate uniqueness: single unique form number field.
 * - Save the data to the database.
 * - Increment the code counter.
 * - Create an audit log entry for this operation.
 * - Publish realtime notification event to the recipient’s channel.
 * - Return a success response.
 */
export class ExtendUseCase extends BaseUseCase<IInput, IDeps, ISuccessData> {
  async handle(input: IInput): Promise<IUseCaseOutputSuccess<ISuccessData> | IUseCaseOutputFailed> {
    // Check whether the user is authorized to perform this action
    const isAuthorized = this.deps.authorizationService.hasAccess(input.authUser.role?.permissions, 'insurances:renew');
    if (!isAuthorized) {
      return this.fail({ code: 403, message: 'You do not have permission to perform this action.' });
    }

    // Check if the record exists.
    const retrieveExistingResponse = await this.deps.retrieveRepository.raw(input.filter._id);
    if (!retrieveExistingResponse) {
      return this.fail({ code: 404, message: 'Resource not found' });
    }

    await this.deps.updateRepository.handle(input.filter._id, {
      status: 'renewed',
      'withdrawal.remaining_amount': 0,
    });

    // Check updated response.
    const retrieveUpdatedResponse = await this.deps.retrieveRepository.raw(input.filter._id);
    if (!retrieveUpdatedResponse) {
      return this.fail({ code: 404, message: 'Resource not found' });
    }

    // Normalizes data (trim).
    const insuranceEntity = new InsuranceEntity({
      form_number: input.data.form_number,
      owner_id: input.data.owner_id,
      group_id: input.data.group_id,
      placement: input.data.placement,
      source: input.data.source,
      interest: input.data.interest,
      interest_schedule: input.data.interest_schedule,
      cashback: input.data.cashback,
      cashback_schedule: input.data.cashback_schedule,
      notes: input.data.notes,
      is_archived: false,
      created_at: new Date(),
      created_by_id: input.authUser._id,
      renewed_id: input.filter._id,
      status: 'active',
    });

    // No interest schedule when is rollover
    if (insuranceEntity.data.interest?.is_rollover) {
      insuranceEntity.data.interest_schedule = [];
    }

    // Check the insterest schedule amount should match with interest net amount.
    const totalInterestAmount = insuranceEntity.data.interest_schedule?.reduce(
      (sum, item) => sum + (item.amount || 0),
      0,
    );
    if (!insuranceEntity.data.interest?.is_rollover && roundNumber(totalInterestAmount ?? 0, 2) !== insuranceEntity.data.interest?.net_amount) {
      return this.fail({ code: 400, message: `Total interest schedule amount (${roundNumber(totalInterestAmount ?? 0, 2)}) does not match net amount (${insuranceEntity.data.interest?.net_amount}).` });
    }

    // Validate uniqueness: single unique code field.
    const uniqueFormNumberErrors = await this.deps.uniqueValidationService.validate(collectionName, { form_number: input.data.form_number });
    if (uniqueFormNumberErrors) {
      return this.fail({ code: 422, message: 'Validation failed due to duplicate values.', errors: uniqueFormNumberErrors });
    }

    // Save the data to the database.
    const createResponse = await this.deps.createRepository.handle(insuranceEntity.data);

    // Increment the code counter.
    await this.deps.codeGeneratorService.increment(collectionName);

    // Create an audit log entry for this operation.
    const changes = this.deps.auditLogService.buildChanges({}, insuranceEntity.data);
    const operationId = this.deps.auditLogService.generateOperationId();
    const dataLog = {
      operation_id: operationId,
      entity_type: collectionName,
      entity_id: createResponse.inserted_id,
      entity_ref: `${input.data.form_number}`,
      actor_type: 'user',
      actor_id: input.authUser._id,
      actor_name: input.authUser.username,
      action: 'extend',
      module: 'insurances',
      system_reason: 'insert data',
      changes: changes,
      metadata: {
        ip: input.ip,
        device: input.userAgent.device,
        browser: input.userAgent.browser,
        os: input.userAgent.os,
      },
      created_at: new Date(),
    };
    await this.deps.auditLogService.log(dataLog);

    // Publish realtime notification event to the recipient’s channel.
    this.deps.ablyService.publish(`notifications:${input.authUser._id}`, 'logs:new', {
      type: 'insurances',
      actor_id: input.authUser._id,
      recipient_id: input.authUser._id,
      is_read: false,
      created_at: new Date(),
      entities: {
        insurances: createResponse.inserted_id,
      },
      data: dataLog,
    });

    // Create an audit log entry for this operation.
    const oldFormChanges = this.deps.auditLogService.buildChanges(retrieveExistingResponse, retrieveUpdatedResponse);
    const oldFormDataLog = {
      operation_id: operationId,
      entity_type: collectionName,
      entity_id: `${retrieveExistingResponse._id}`,
      entity_ref: `${retrieveExistingResponse.form_number}`,
      actor_type: 'user',
      actor_id: input.authUser._id,
      actor_name: input.authUser.username,
      action: 'extend',
      module: 'insurances',
      system_reason: 'updating old form status',
      changes: oldFormChanges,
      metadata: {
        ip: input.ip,
        device: input.userAgent.device,
        browser: input.userAgent.browser,
        os: input.userAgent.os,
      },
      created_at: new Date(),
    };
    await this.deps.auditLogService.log(oldFormDataLog);

    // Return a success response.
    return this.success({
      inserted_id: createResponse.inserted_id,
    });
  }
}
