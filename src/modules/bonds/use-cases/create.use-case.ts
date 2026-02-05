import { BaseUseCase, type IUseCaseOutputFailed, type IUseCaseOutputSuccess } from '@point-hub/papi';

import type { IAuthorizationService } from '@/modules/_shared/services/authorization.service';
import type { IUniqueValidationService } from '@/modules/_shared/services/unique-validation.service';
import type { IUserAgent } from '@/modules/_shared/types/user-agent.type';
import type { IAblyService } from '@/modules/ably/services/ably.service';
import type { IAuditLogService } from '@/modules/audit-logs/services/audit-log.service';
import type { ICodeGeneratorService } from '@/modules/counters/services/code-generator.service';
import type { IAuthUser } from '@/modules/master/users/interface';

import { BondEntity, collectionName } from '../entity';
import type { IReceivedCoupon } from '../interface';
import type { ICreateRepository } from '../repositories/create.repository';

export interface IInput {
  ip: string
  authUser: IAuthUser
  userAgent: IUserAgent
  data: {
    form_number?: string;
    product?: string;
    publisher?: string;
    type?: string;
    series?: string;
    year_issued?: string;
    bank_source_id?: string;
    bank_source_account_uuid?: string;
    bank_placement_id?: string;
    bank_placement_account_uuid?: string;
    owner_id?: string;
    base_date?: number;
    transaction_date?: string;
    settlement_date?: string;
    maturity_date?: string;
    transaction_number?: number;
    price?: number;
    principal_amount?: number;
    proceed_amount?: number;
    accrued_interest?: number;
    total_proceed?: number;
    coupon_tenor?: number;
    coupon_rate?: number;
    coupon_gross_amount?: number;
    coupon_tax_rate?: number;
    coupon_tax_amount?: number;
    coupon_net_amount?: number;
    coupon_date?: string;
    received_coupons?: IReceivedCoupon[];
    notes?: string | null;
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
 * Use case: Create Bond.
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
export class CreateUseCase extends BaseUseCase<IInput, IDeps, ISuccessData> {
  async handle(input: IInput): Promise<IUseCaseOutputSuccess<ISuccessData> | IUseCaseOutputFailed> {
    // Check whether the user is authorized to perform this action
    const isAuthorized = this.deps.authorizationService.hasAccess(input.authUser.role?.permissions, 'bonds:create');
    if (!isAuthorized) {
      return this.fail({ code: 403, message: 'You do not have permission to perform this action.' });
    }

    // Normalizes data (trim).
    const bondEntity = new BondEntity({
      form_number: input.data.form_number,
      product: input.data.product,
      publisher: input.data.publisher,
      type: input.data.type,
      series: input.data.series,
      year_issued: input.data.year_issued,

      bank_source_id: input.data.bank_source_id,
      bank_source_account_uuid: input.data.bank_source_account_uuid,

      bank_placement_id: input.data.bank_placement_id,
      bank_placement_account_uuid: input.data.bank_placement_account_uuid,

      owner_id: input.data.owner_id,

      base_date: input.data.base_date,
      transaction_date: input.data.transaction_date,
      settlement_date: input.data.settlement_date,
      maturity_date: input.data.maturity_date,

      transaction_number: input.data.transaction_number,

      price: input.data.price,
      principal_amount: input.data.principal_amount,
      remaining_amount: input.data.principal_amount,
      proceed_amount: input.data.proceed_amount,
      accrued_interest: input.data.accrued_interest,
      total_proceed: input.data.total_proceed,

      coupon_tenor: input.data.coupon_tenor,
      coupon_rate: input.data.coupon_rate,

      coupon_gross_amount: input.data.coupon_gross_amount,
      coupon_tax_rate: input.data.coupon_tax_rate,
      coupon_tax_amount: input.data.coupon_tax_amount,
      coupon_net_amount: input.data.coupon_net_amount,
      coupon_date: input.data.coupon_date,

      notes: input.data.notes,
      is_archived: false,
      created_at: new Date(),
      created_by_id: input.authUser._id,
      status: 'active',
    });

    // Validate uniqueness: form_number field.
    const uniqueFormNumberErrors = await this.deps.uniqueValidationService.validate(collectionName, { form_number: input.data.form_number });
    if (uniqueFormNumberErrors) {
      return this.fail({ code: 422, message: 'Validation failed due to duplicate values.', errors: uniqueFormNumberErrors });
    }

    // Save the data to the database.
    const createResponse = await this.deps.createRepository.handle(bondEntity.data);

    // Increment the code counter.
    await this.deps.codeGeneratorService.increment(collectionName);

    // Create an audit log entry for this operation.
    const changes = this.deps.auditLogService.buildChanges({}, bondEntity.data);
    const dataLog = {
      operation_id: this.deps.auditLogService.generateOperationId(),
      entity_type: collectionName,
      entity_id: createResponse.inserted_id,
      entity_ref: `${input.data.form_number}`,
      actor_type: 'user',
      actor_id: input.authUser._id,
      actor_name: input.authUser.username,
      action: 'create',
      module: 'bonds',
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
      type: 'bonds',
      actor_id: input.authUser._id,
      recipient_id: input.authUser._id,
      is_read: false,
      created_at: new Date(),
      entities: {
        bonds: createResponse.inserted_id,
      },
      data: dataLog,
    });

    // Return a success response.
    return this.success({
      inserted_id: createResponse.inserted_id,
    });
  }
}
