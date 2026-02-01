import { BaseUseCase, type IUseCaseOutputFailed, type IUseCaseOutputSuccess } from '@point-hub/papi';

import type { IAuthorizationService } from '@/modules/_shared/services/authorization.service';
import type { IUniqueValidationService } from '@/modules/_shared/services/unique-validation.service';
import type { IUserAgent } from '@/modules/_shared/types/user-agent.type';
import type { IAblyService } from '@/modules/ably/services/ably.service';
import type { IAuditLogService } from '@/modules/audit-logs/services/audit-log.service';
import type { ICodeGeneratorService } from '@/modules/counters/services/code-generator.service';
import type { IAuthUser } from '@/modules/master/users/interface';

import { collectionName, SavingEntity } from '../entity';
import type { ICreateRepository } from '../repositories/create.repository';

export interface IInput {
  ip: string
  authUser: IAuthUser
  userAgent: IUserAgent
  data: {
    form_number?: string
    owner_id?: string
    group_id?: string
    placement?: {
      type?: string
      bank_id?: string
      account_number?: string
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
 * Use case: Create Saving.
 *
 * Responsibilities:
 * - Check whether the user is authorized to perform this action.
 * - Normalizes data (trim).
 * - Validate uniqueness: single unique code field.
 * - Validate uniqueness: single unique name field.
 * - Save the data to the database.
 * - Increment the code counter.
 * - Create an audit log entry for this operation.
 * - Publish realtime notification event to the recipient’s channel.
 * - Return a success response.
 */
export class DraftUseCase extends BaseUseCase<IInput, IDeps, ISuccessData> {
  async handle(input: IInput): Promise<IUseCaseOutputSuccess<ISuccessData> | IUseCaseOutputFailed> {
    // Check whether the user is authorized to perform this action
    const isAuthorized = this.deps.authorizationService.hasAccess(input.authUser.role?.permissions, 'savings:create');
    if (!isAuthorized) {
      return this.fail({ code: 403, message: 'You do not have permission to perform this action.' });
    }

    // Normalizes data (trim).
    const savingEntity = new SavingEntity({
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
      status: 'draft',
    });

    // No interest schedule when is rollover
    if (savingEntity.data.interest?.is_rollover) {
      savingEntity.data.interest_schedule = [];
    }

    // Validate uniqueness: single unique code field.
    const uniqueFormNumberErrors = await this.deps.uniqueValidationService.validate(collectionName, { form_number: input.data.form_number });
    if (uniqueFormNumberErrors) {
      return this.fail({ code: 422, message: 'Validation failed due to duplicate values.', errors: uniqueFormNumberErrors });
    }

    // Save the data to the database.
    const createResponse = await this.deps.createRepository.handle(savingEntity.data);

    // Increment the code counter.
    await this.deps.codeGeneratorService.increment(collectionName);

    // Create an audit log entry for this operation.
    const changes = this.deps.auditLogService.buildChanges({}, savingEntity.data);
    const dataLog = {
      operation_id: this.deps.auditLogService.generateOperationId(),
      entity_type: collectionName,
      entity_id: createResponse.inserted_id,
      entity_ref: `${input.data.form_number}`,
      actor_type: 'user',
      actor_id: input.authUser._id,
      actor_name: input.authUser.username,
      action: 'draft',
      module: 'savings',
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
      type: 'savings',
      actor_id: input.authUser._id,
      recipient_id: input.authUser._id,
      is_read: false,
      created_at: new Date(),
      entities: {
        savings: createResponse.inserted_id,
      },
      data: dataLog,
    });

    // Return a success response.
    return this.success({
      inserted_id: createResponse.inserted_id,
    });
  }
}
