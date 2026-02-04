import { BaseUseCase, type IUseCaseOutputFailed, type IUseCaseOutputSuccess } from '@point-hub/papi';

import type { IAuthorizationService } from '@/modules/_shared/services/authorization.service';
import type { IUniqueValidationService } from '@/modules/_shared/services/unique-validation.service';
import type { IUserAgent } from '@/modules/_shared/types/user-agent.type';
import type { IAblyService } from '@/modules/ably/services/ably.service';
import type { IAuditLogService } from '@/modules/audit-logs/services/audit-log.service';
import type { ICodeGeneratorService } from '@/modules/counters/services/code-generator.service';
import type { IAuthUser } from '@/modules/master/users/interface';

import { collectionName, DividendStockEntity } from '../entity';
import type { ICreateRepository } from '../repositories/create.repository';

export interface IInput {
  ip: string
  authUser: IAuthUser
  userAgent: IUserAgent
  data: {
    _id?: string
    form_number?: string
    dividend_date?: string
    broker_id?: string
    bank_id?: string
    bank_account_uuid?: string
    transactions?: {
      uuid?: string
      issuer_id?: string
      owner_id?: string
      shares?: number
      dividend_amount?: number
      total_dividend?: number
      received_amount?: number
    }[]
    total_received?: number
    notes?: string | null | undefined
    is_archived?: boolean | null
    status?: 'draft' | 'active'
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
 * Use case: Create Dividend Stock.
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
    const isAuthorized = this.deps.authorizationService.hasAccess(input.authUser.role?.permissions, 'dividend-stocks:create');
    if (!isAuthorized) {
      return this.fail({ code: 403, message: 'You do not have permission to perform this action.' });
    }

    // Normalizes data (trim).
    const dividendStockEntity = new DividendStockEntity({
      form_number: input.data.form_number,
      dividend_date: input.data.dividend_date,
      broker_id: input.data.broker_id,
      bank_id: input.data.bank_id,
      bank_account_uuid: input.data.bank_account_uuid,
      transactions: input.data.transactions?.map(item => {
        return {
          issuer_id: item.issuer_id,
          owner_id: item.owner_id,
          shares: item.shares,
          dividend_amount: item.dividend_amount,
          total_dividend: item.total_dividend,
          received_amount: item.received_amount,
        };
      }),
      total_received: input.data.total_received,
      notes: input.data.notes,
      is_archived: false,
      created_at: new Date(),
      created_by_id: input.authUser._id,
      status: 'draft',
    });

    // Validate uniqueness: single unique code field.
    const uniqueFormNumberErrors = await this.deps.uniqueValidationService.validate(collectionName, { form_number: input.data.form_number });
    if (uniqueFormNumberErrors) {
      return this.fail({ code: 422, message: 'Validation failed due to duplicate values.', errors: uniqueFormNumberErrors });
    }

    // Save the data to the database.
    const createResponse = await this.deps.createRepository.handle(dividendStockEntity.data);

    // Increment the code counter.
    await this.deps.codeGeneratorService.increment(collectionName);

    // Create an audit log entry for this operation.
    const changes = this.deps.auditLogService.buildChanges({}, dividendStockEntity.data);
    const dataLog = {
      operation_id: this.deps.auditLogService.generateOperationId(),
      entity_type: collectionName,
      entity_id: createResponse.inserted_id,
      entity_ref: `${input.data.form_number}`,
      actor_type: 'user',
      actor_id: input.authUser._id,
      actor_name: input.authUser.username,
      action: 'draft',
      module: 'dividend-stocks',
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
      type: 'dividend_stocks',
      actor_id: input.authUser._id,
      recipient_id: input.authUser._id,
      is_read: false,
      created_at: new Date(),
      entities: {
        dividend_stocks: createResponse.inserted_id,
      },
      data: dataLog,
    });

    // Return a success response.
    return this.success({
      inserted_id: createResponse.inserted_id,
    });
  }
}
