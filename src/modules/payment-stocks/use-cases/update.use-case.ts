import { BaseUseCase, type IUseCaseOutputFailed, type IUseCaseOutputSuccess } from '@point-hub/papi';

import type { IAuthorizationService } from '@/modules/_shared/services/authorization.service';
import type { IUniqueValidationService } from '@/modules/_shared/services/unique-validation.service';
import type { IUserAgent } from '@/modules/_shared/types/user-agent.type';
import type { IAblyService } from '@/modules/ably/services/ably.service';
import type { IAuditLogService } from '@/modules/audit-logs/services/audit-log.service';
import type { IAuthUser } from '@/modules/master/users/interface';

import { collectionName, PaymentStockEntity } from '../entity';
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
    broker_id?: string
    payment_date?: string
    transactions?: {
      uuid?: string
      stock_id?: string
      date?: number
      transaction_number?: number
      amount?: number
    }[]
    total?: number
    notes?: string | null | undefined
    is_archived?: boolean | null
    status?: 'draft' | 'active'
    update_reason?: string
    created_at?: Date
    created_by_id?: string
    updated_at?: Date | null
    updated_by_id?: string | null
    archived_at?: Date | null
    archived_by_id?: string | null
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
 * Use case: Update Payment Stock.
 *
 * Responsibilities:
 * - Check whether the user is authorized to perform this action
 * - Check if the record exists
 * - Normalizes data (trim).
 * - Check the insterest schedule amount should match with interest net amount.
 * - Reject update when no fields have changed
 * - Save the data to the database.
 * - Create an audit log entry for this operation.
 * - Publish realtime notification event to the recipient’s channel.
 * - Return a success response.
 */
export class UpdateUseCase extends BaseUseCase<IInput, IDeps, ISuccessData> {
  async handle(input: IInput): Promise<IUseCaseOutputSuccess<ISuccessData> | IUseCaseOutputFailed> {
    // Check whether the user is authorized to perform this action
    const isAuthorized = this.deps.authorizationService.hasAccess(input.authUser.role?.permissions, 'payment-stocks:update');
    if (!isAuthorized) {
      return this.fail({ code: 403, message: 'You do not have permission to perform this action.' });
    }

    // Check if the record exists.
    const retrieveResponse = await this.deps.retrieveRepository.raw(input.filter._id);
    if (!retrieveResponse) {
      return this.fail({ code: 404, message: 'Resource not found' });
    }

    // Normalizes data (trim).
    const paymentStockEntity = new PaymentStockEntity({
      payment_date: input.data?.payment_date,
      broker_id: input.data?.broker_id,
      transactions: input.data?.transactions,
      total: input.data?.total,
      notes: input.data?.notes,
      status: 'active',
      updated_at: new Date(),
      updated_by_id: input.authUser._id,
    });

    // Reject update when no fields have changed
    const changes = this.deps.auditLogService.buildChanges(
      retrieveResponse,
      this.deps.auditLogService.mergeDefined(retrieveResponse, paymentStockEntity.data),
    );
    if (changes.summary.fields?.length === 0) {
      return this.fail({ code: 400, message: 'No changes detected. Please modify at least one field before saving.' });
    }

    // Save the data to the database.
    const response = await this.deps.updateRepository.handle(input.filter._id, paymentStockEntity.data);

    // Create an audit log entry for this operation.
    const dataLog = {
      operation_id: this.deps.auditLogService.generateOperationId(),
      entity_type: collectionName,
      entity_id: input.filter._id,
      entity_ref: `${retrieveResponse.form_number}`,
      actor_type: 'user',
      actor_id: input.authUser._id,
      actor_name: input.authUser.username,
      action: 'update',
      module: 'payment-stocks',
      system_reason: 'update data',
      user_reason: input.data?.update_reason,
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
      type: 'payment_stocks',
      actor_id: input.authUser._id,
      recipient_id: input.authUser._id,
      is_read: false,
      created_at: new Date(),
      entities: {
        payment_stocks: input.filter._id,
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
