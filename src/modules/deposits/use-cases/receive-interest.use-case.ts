import { BaseUseCase, type IUseCaseOutputFailed, type IUseCaseOutputSuccess } from '@point-hub/papi';

import type { IAuthorizationService } from '@/modules/_shared/services/authorization.service';
import type { IUniqueValidationService } from '@/modules/_shared/services/unique-validation.service';
import type { IUserAgent } from '@/modules/_shared/types/user-agent.type';
import type { IAblyService } from '@/modules/ably/services/ably.service';
import type { IAuditLogService } from '@/modules/audit-logs/services/audit-log.service';
import type { IAuthUser } from '@/modules/master/users/interface';
import { roundNumber } from '@/utils/number';

import type { IReceiveInterestRepository } from '../repositories/receive-interest.repository';
import type { IRetrieveRepository } from '../repositories/retrieve.repository';

export interface IInput {
  ip: string
  authUser: IAuthUser
  userAgent: IUserAgent
  filter: {
    _id: string
  }
  data?: {
    payment_date?: string
    amount?: number
    bank_id?: string
    bank_account_uuid?: string
    received_date?: string
    received_amount?: number
    additional_bank_id?: string
    additional_bank_account_uuid?: string
    received_additional_payment_date?: string
    received_additional_payment_amount?: number
    remaining_amount?: number
  }
}

export interface IDeps {
  receiveInterestRepository: IReceiveInterestRepository
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
 * Use case: Update Deposit.
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
export class ReceiveInterestUseCase extends BaseUseCase<IInput, IDeps, ISuccessData> {
  async handle(input: IInput): Promise<IUseCaseOutputSuccess<ISuccessData> | IUseCaseOutputFailed> {
    // Check whether the user is authorized to perform this action
    const isAuthorized = this.deps.authorizationService.hasAccess(input.authUser.role?.permissions, 'deposits:update');
    if (!isAuthorized) {
      return this.fail({ code: 403, message: 'You do not have permission to perform this action.' });
    }

    // Check if the record exists.
    const retrieveResponse = await this.deps.retrieveRepository.raw(input.filter._id);
    if (!retrieveResponse) {
      return this.fail({ code: 404, message: 'Resource not found' });
    }

    // Normalizes data (trim).
    const remainingAmount = roundNumber((input.data?.amount ?? 0)
      - (input.data?.received_amount ?? 0)
      - (input.data?.received_additional_payment_amount ?? 0), 2);

    const data = {
      payment_date: input.data?.payment_date,
      amount: input.data?.amount,
      bank_id: input.data?.bank_id,
      bank_account_uuid: input.data?.bank_account_uuid,
      received_date: input.data?.received_date,
      received_amount: input.data?.received_amount,
      additional_bank_id: input.data?.additional_bank_id,
      additional_bank_account_uuid: input.data?.additional_bank_account_uuid,
      received_additional_payment_date: input.data?.received_additional_payment_date,
      received_additional_payment_amount: input.data?.received_additional_payment_amount,
      remaining_amount: remainingAmount,
      created_by_id: input.authUser._id,
      created_at: new Date(),
    };

    // Reject update when no fields have changed
    // const changes = this.deps.auditLogService.buildChanges(
    //   retrieveResponse,
    //   this.deps.auditLogService.mergeDefined(retrieveResponse, data),
    // );
    // if (changes.summary.fields?.length === 0) {
    //   return this.fail({ code: 400, message: 'No changes detected. Please modify at least one field before saving.' });
    // }

    // Save the data to the database.
    const response = await this.deps.receiveInterestRepository.handle(input.filter._id, data);

    // Create an audit log entry for this operation.
    // const dataLog = {
    //   operation_id: this.deps.auditLogService.generateOperationId(),
    //   entity_type: collectionName,
    //   entity_id: input.filter._id,
    //   entity_ref: retrieveResponse.form_number!,
    //   actor_type: 'user',
    //   actor_id: input.authUser._id,
    //   actor_name: input.authUser.username,
    //   action: 'receive-interest',
    //   module: 'deposits',
    //   system_reason: 'update data',
    //   changes: changes,
    //   metadata: {
    //     ip: input.ip,
    //     device: input.userAgent.device,
    //     browser: input.userAgent.browser,
    //     os: input.userAgent.os,
    //   },
    //   created_at: new Date(),
    // };
    // await this.deps.auditLogService.log(dataLog);

    // Publish realtime notification event to the recipient’s channel.
    // this.deps.ablyService.publish(`notifications:${input.authUser._id}`, 'logs:new', {
    //   type: 'deposits',
    //   actor_id: input.authUser._id,
    //   recipient_id: input.authUser._id,
    //   is_read: false,
    //   created_at: new Date(),
    //   entities: {
    //     deposits: input.filter._id,
    //   },
    //   data: dataLog,
    // });

    // Return a success response.
    return this.success({
      matched_count: response.matched_count,
      modified_count: response.modified_count,
    });
  }
}
