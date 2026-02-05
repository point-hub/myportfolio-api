import { BaseUseCase, type IQuery, type IUseCaseOutputFailed, type IUseCaseOutputSuccess } from '@point-hub/papi';

import type { IAuthorizationService } from '@/modules/_shared/services/authorization.service';
import type { IBank } from '@/modules/master/banks/interface';
import type { IOwner } from '@/modules/master/owners/interface';
import type { IAuthUser } from '@/modules/master/users/interface';

import type { IBond } from '../interface';
import type { IRetrieveManyRepository } from '../repositories/retrieve-many.repository';

export interface IInput {
  authUser: IAuthUser
  query: IQuery
}

export interface IDeps {
  retrieveManyRepository: IRetrieveManyRepository
  authorizationService: IAuthorizationService
}

export interface IData extends IBond {
  bank_source?: IBank
  bank_placement?: IBank
  owner?: IOwner
  created_by?: IAuthUser
  updated_by?: IAuthUser
  archived_by?: IAuthUser
}

export interface ISuccessData {
  data: IData[]
  pagination: {
    page: number
    page_count: number
    page_size: number
    total_document: number
  }
}

/**
 * Use case: Retrieve Bonds.
 *
 * Responsibilities:
 * - Check whether the user is authorized to perform this action
 * - Retrieve all data from the database.
 * - Optionally filter response fields using `query.fields`.
 * - Return a success response.
 */
export class RetrieveManyUseCase extends BaseUseCase<IInput, IDeps, ISuccessData> {
  async handle(input: IInput): Promise<IUseCaseOutputSuccess<ISuccessData> | IUseCaseOutputFailed> {
    // Check whether the user is authorized to perform this action
    const isAuthorized = this.deps.authorizationService.hasAccess(input.authUser.role?.permissions, 'bonds:read');
    if (!isAuthorized) {
      return this.fail({ code: 403, message: 'You do not have permission to perform this action.' });
    }

    // Retrieve all data from the database.
    const response = await this.deps.retrieveManyRepository.handle(input.query);

    // Optionally filter response fields using `query.fields`.
    const fields = typeof input.query.fields === 'string'
      ? input.query.fields.split(',').map(f => f.trim())
      : null;

    // Return a success response.
    return this.success({
      data: response.data.map(item => {
        const mapped = {
          _id: item._id,
          form_number: item.form_number,
          product: item.product,
          publisher: item.publisher,
          type: item.type,
          series: item.series,
          year_issued: item.year_issued,

          bank_source: item.bank_source,
          bank_source_id: item.bank_source_id,
          bank_source_account_uuid: item.bank_source_account_uuid,

          bank_placement: item.bank_placement,
          bank_placement_id: item.bank_placement_id,
          bank_placement_account_uuid: item.bank_placement_account_uuid,

          owner: item.owner,
          owner_id: item.owner_id,

          base_date: item.base_date,
          transaction_date: item.transaction_date,
          settlement_date: item.settlement_date,
          maturity_date: item.maturity_date,

          transaction_number: item.transaction_number,

          price: item.price,
          principal_amount: item.principal_amount,
          proceed_amount: item.proceed_amount,
          accrued_interest: item.accrued_interest,
          total_proceed: item.total_proceed,

          coupon_tenor: item.coupon_tenor,
          coupon_rate: item.coupon_rate,

          coupon_gross_amount: item.coupon_gross_amount,
          coupon_tax_rate: item.coupon_tax_rate,
          coupon_tax_amount: item.coupon_tax_amount,
          coupon_net_amount: item.coupon_net_amount,

          notes: item.notes,
          status: item.status,
          is_archived: item.is_archived,
        };

        // If no fields requested → return full object
        if (!fields) return mapped;

        // Otherwise → return only requested fields
        return Object.fromEntries(
          Object.entries(mapped).filter(([key]) => fields.includes(key)),
        );
      }),
      pagination: response.pagination,
    });
  }
}
