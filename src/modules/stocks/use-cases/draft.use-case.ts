import { BaseUseCase, type IUseCaseOutputFailed, type IUseCaseOutputSuccess } from '@point-hub/papi';

import type { IAuthorizationService } from '@/modules/_shared/services/authorization.service';
import type { IUniqueValidationService } from '@/modules/_shared/services/unique-validation.service';
import type { IUserAgent } from '@/modules/_shared/types/user-agent.type';
import type { IAblyService } from '@/modules/ably/services/ably.service';
import type { IAuditLogService } from '@/modules/audit-logs/services/audit-log.service';
import type { ICodeGeneratorService } from '@/modules/counters/services/code-generator.service';
import type { IAuthUser } from '@/modules/master/users/interface';

import { collectionName, StockEntity } from '../entity';
import type { ICreateRepository } from '../repositories/create.repository';

export interface IInput {
  ip: string
  authUser: IAuthUser
  userAgent: IUserAgent
  data: {
    form_number: string
    transaction_date: string
    settlement_date: Date
    broker_id: string
    owner_id: string
    transaction_number: string
    buying_list: {
      issuer_id: string
      lots: number
      shares: number
      price: number
      total: number
    }[]
    selling_list: {
      issuer_id: string
      lots: number
      shares: number
      price: number
      total: number
    }[]
    buying_total?: number
    buying_brokerage_fee?: number
    buying_vat?: number
    buying_levy?: number
    buying_kpei?: number
    buying_stamp?: number
    buying_proceed?: number
    selling_total?: number
    selling_brokerage_fee?: number
    selling_vat?: number
    selling_levy?: number
    selling_kpei?: number
    selling_stamp?: number
    selling_proceed?: number
    proceed_amount?: number
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
 * Use case: Create Stock.
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
    const isAuthorized = this.deps.authorizationService.hasAccess(input.authUser.role?.permissions, 'stocks:create');
    if (!isAuthorized) {
      return this.fail({ code: 403, message: 'You do not have permission to perform this action.' });
    }

    // Normalizes data (trim).
    const stockEntity = new StockEntity({
      form_number: input.data.form_number,
      transaction_date: input.data.transaction_date,
      settlement_date: input.data.settlement_date,
      broker_id: input.data.broker_id,
      owner_id: input.data.owner_id,
      transaction_number: input.data.transaction_number,
      buying_list: input.data.buying_list,
      selling_list: input.data.selling_list,
      buying_total: input.data.buying_total,
      buying_brokerage_fee: input.data.buying_brokerage_fee,
      buying_vat: input.data.buying_vat,
      buying_levy: input.data.buying_levy,
      buying_kpei: input.data.buying_kpei,
      buying_stamp: input.data.buying_stamp,
      buying_proceed: input.data.buying_proceed,
      selling_total: input.data.selling_total,
      selling_brokerage_fee: input.data.selling_brokerage_fee,
      selling_vat: input.data.selling_vat,
      selling_levy: input.data.selling_levy,
      selling_kpei: input.data.selling_kpei,
      selling_stamp: input.data.selling_stamp,
      selling_proceed: input.data.selling_proceed,
      proceed_amount: input.data.proceed_amount,
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
    const createResponse = await this.deps.createRepository.handle(stockEntity.data);

    // Increment the code counter.
    await this.deps.codeGeneratorService.increment(collectionName);

    // Create an audit log entry for this operation.
    const changes = this.deps.auditLogService.buildChanges({}, stockEntity.data);
    const dataLog = {
      operation_id: this.deps.auditLogService.generateOperationId(),
      entity_type: collectionName,
      entity_id: createResponse.inserted_id,
      entity_ref: `${input.data.form_number}`,
      actor_type: 'user',
      actor_id: input.authUser._id,
      actor_name: input.authUser.username,
      action: 'draft',
      module: 'stocks',
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
      type: 'stocks',
      actor_id: input.authUser._id,
      recipient_id: input.authUser._id,
      is_read: false,
      created_at: new Date(),
      entities: {
        stocks: createResponse.inserted_id,
      },
      data: dataLog,
    });

    // Return a success response.
    return this.success({
      inserted_id: createResponse.inserted_id,
    });
  }
}
