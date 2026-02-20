import { BaseUseCase, type IUseCaseOutputFailed, type IUseCaseOutputSuccess } from '@point-hub/papi';

import type { IAuthorizationService } from '@/modules/_shared/services/authorization.service';
import type { IUniqueValidationService } from '@/modules/_shared/services/unique-validation.service';
import type { IUserAgent } from '@/modules/_shared/types/user-agent.type';
import type { IAblyService } from '@/modules/ably/services/ably.service';
import type { IAuditLogService } from '@/modules/audit-logs/services/audit-log.service';
import type { IAuthUser } from '@/modules/master/users/interface';
import { roundNumber } from '@/utils/number';

import { collectionName } from '../entity';
import type { IRetrieveRepository } from '../repositories/retrieve.repository';
import type { IUpdateRepository } from '../repositories/update.repository';

export interface IInput {
  ip: string
  authUser: IAuthUser
  userAgent: IUserAgent
  filter: {
    _id: string
  }
  data?: {
    amount?: number
    bank_id?: string
    bank_account_uuid?: string
    received_date?: string
    received_amount?: number
    remaining_amount?: number
    notes?: string
  }
}

export interface IDeps {
  updateRepository: IUpdateRepository
  retrieveRepository: IRetrieveRepository
  ablyService: IAblyService
  auditLogService: IAuditLogService
  authorizationService: IAuthorizationService
  uniqueValidationService: IUniqueValidationService
}

export interface ISuccessData {
  matched_count: number
  modified_count: number
}

/**
 * Use case: Update Insurance.
 *
 * Responsibilities:
 * - Check whether the user is authorized to perform this action
 * - Check if the record exists
 * - Normalizes data (trim).
 * - Reject update when no fields have changed
 * - Save the data to the database.
 * - Create an audit log entry for this operation.
 * - Publish realtime notification event to the recipient’s channel.
 * - Return a success response.
 */
export class WithdrawalUseCase extends BaseUseCase<IInput, IDeps, ISuccessData> {
  async handle(input: IInput): Promise<IUseCaseOutputSuccess<ISuccessData> | IUseCaseOutputFailed> {
    // Check whether the user is authorized to perform this action
    const isAuthorized = this.deps.authorizationService.hasAccess(input.authUser.role?.permissions, 'insurances:withdraw');
    if (!isAuthorized) {
      return this.fail({ code: 403, message: 'You do not have permission to perform this action.' });
    }

    // Check if the record exists.
    const retrieveExistingResponse = await this.deps.retrieveRepository.raw(input.filter._id);
    if (!retrieveExistingResponse) {
      return this.fail({ code: 404, message: 'Resource not found' });
    }

    if (retrieveExistingResponse.status === 'renewed') {
      return this.fail({ code: 400, message: 'Cannot withdraw this form because already renewed' });
    }

    // Normalizes data (trim).
    const remainingAmount = roundNumber((input.data?.amount ?? 0) - (input.data?.received_amount ?? 0), 2);
    const status = remainingAmount <= 0 ? 'withdrawn' : 'active';
    const data = {
      withdrawal: {
        amount: input.data?.amount,
        bank_id: input.data?.bank_id,
        bank_account_uuid: input.data?.bank_account_uuid,
        received_date: input.data?.received_date,
        received_amount: input.data?.received_amount,
        remaining_amount: remainingAmount,
        notes: input.data?.notes,
        created_by_id: input.authUser._id,
        created_at: new Date(),
      },
      status: status,
    };

    // Save the data to the database.
    const response = await this.deps.updateRepository.handle(input.filter._id, data);

    // Check updated response.
    const retrieveUpdatedResponse = await this.deps.retrieveRepository.raw(input.filter._id);
    if (!retrieveUpdatedResponse) {
      return this.fail({ code: 404, message: 'Resource not found' });
    }

    // Reject update when no fields have changed
    const changes = this.deps.auditLogService.buildChanges(
      retrieveExistingResponse,
      retrieveUpdatedResponse,
    );
    if (changes.summary.fields?.length === 0) {
      return this.fail({ code: 400, message: 'No changes detected. Please modify at least one field before saving.' });
    }

    // Create an audit log entry for this operation.
    const dataLog = {
      operation_id: this.deps.auditLogService.generateOperationId(),
      entity_type: collectionName,
      entity_id: input.filter._id,
      entity_ref: retrieveExistingResponse.form_number!,
      actor_type: 'user',
      actor_id: input.authUser._id,
      actor_name: input.authUser.username,
      action: 'withdraw',
      module: 'insurances',
      system_reason: 'update data',
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
        insurances: input.filter._id,
      },
      data: dataLog,
    });

    // Return a success response.
    return this.success({
      matched_count: response.matched_count,
      modified_count: response.modified_count,
    });
  }
}
