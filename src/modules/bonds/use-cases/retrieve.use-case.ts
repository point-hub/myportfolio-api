import { BaseUseCase, type IUseCaseOutputFailed, type IUseCaseOutputSuccess } from '@point-hub/papi';

import type { IAuthorizationService } from '@/modules/_shared/services/authorization.service';
import type { IBank } from '@/modules/master/banks/interface';
import type { IOwner } from '@/modules/master/owners/interface';
import type { IAuthUser } from '@/modules/master/users/interface';

import type { IBond } from '../interface';
import type { IRetrieveRepository } from '../repositories/retrieve.repository';

export interface IInput {
  authUser: IAuthUser
  filter: {
    _id: string
  }
}

export interface IDeps {
  retrieveRepository: IRetrieveRepository
  authorizationService: IAuthorizationService
}

export interface ISuccessData extends IBond {
  bank_source?: IBank
  bank_placement?: IBank
  owner?: IOwner
  created_by?: IAuthUser
  updated_by?: IAuthUser
  archived_by?: IAuthUser
}

/**
 * Use case: Retrieve Bond.
 *
 * Responsibilities:
 * - Check whether the user is authorized to perform this action
 * - Retrieve a single data record from the database.
 * - Return a success response.
 */
export class RetrieveUseCase extends BaseUseCase<IInput, IDeps, ISuccessData> {
  async handle(input: IInput): Promise<IUseCaseOutputSuccess<ISuccessData> | IUseCaseOutputFailed> {
    // Check whether the user is authorized to perform this action
    const isAuthorized = this.deps.authorizationService.hasAccess(input.authUser.role?.permissions, 'bonds:read');
    if (!isAuthorized) {
      return this.fail({ code: 403, message: 'You do not have permission to perform this action.' });
    }

    // Retrieve a single data record from the database.
    const response = await this.deps.retrieveRepository.handle(input.filter._id);
    if (!response) {
      return this.fail({
        code: 404,
        message: 'The requested data does not exist.',
      });
    }

    // Return a success response.
    return this.success({
      _id: response._id,
      form_number: response.form_number,
      product: response.product,
      publisher: response.publisher,
      type: response.type,
      series: response.series,
      year_issued: response.year_issued,

      bank_source: response.bank_source,
      bank_source_id: response.bank_source_id,
      bank_source_account_uuid: response.bank_source_account_uuid,

      bank_placement: response.bank_placement,
      bank_placement_id: response.bank_placement_id,
      bank_placement_account_uuid: response.bank_placement_account_uuid,

      owner: response.owner,
      owner_id: response.owner_id,

      base_date: response.base_date,
      transaction_date: response.transaction_date,
      settlement_date: response.settlement_date,
      maturity_date: response.maturity_date,
      last_coupon_date: response.last_coupon_date,

      transaction_number: response.transaction_number,

      price: response.price,
      principal_amount: response.principal_amount,
      proceed_amount: response.proceed_amount,
      accrued_interest: response.accrued_interest,
      total_proceed: response.total_proceed,

      coupon_tenor: response.coupon_tenor,
      coupon_rate: response.coupon_rate,

      coupon_gross_amount: response.coupon_gross_amount,
      coupon_tax_rate: response.coupon_tax_rate,
      coupon_tax_amount: response.coupon_tax_amount,
      coupon_net_amount: response.coupon_net_amount,
      coupon_date: response.coupon_date,
      received_coupons: response.received_coupons,

      selling_price: response.selling_price,
      disbursement_date: response.disbursement_date,
      disbursement_amount: response.disbursement_amount,
      disbursement_amount_difference: response.disbursement_amount_difference,
      disbursement_amount_received: response.disbursement_amount_received,
      disbursement_bank_id: response.disbursement_bank_id,
      disbursement_bank_account_uuid: response.disbursement_bank_account_uuid,
      disbursement_remaining: response.disbursement_remaining,

      notes: response.notes,
      status: response.status,
      coupon_status: response.coupon_status,
      is_archived: response.is_archived,
    });
  }
}
