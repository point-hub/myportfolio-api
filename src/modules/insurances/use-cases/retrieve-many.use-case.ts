import { BaseUseCase, type IQuery, type IUseCaseOutputFailed, type IUseCaseOutputSuccess } from '@point-hub/papi';

import type { IAuthorizationService } from '@/modules/_shared/services/authorization.service';
import type { IBank } from '@/modules/master/banks/interface';
import type { IOwner } from '@/modules/master/owners/interface';
import type { IAuthUser } from '@/modules/master/users/interface';

import type { IRetrieveManyRepository } from '../repositories/retrieve-many.repository';

export interface IInput {
  authUser: IAuthUser
  query: IQuery
}

export interface IDeps {
  retrieveManyRepository: IRetrieveManyRepository
  authorizationService: IAuthorizationService
}

export interface ISuccessData {
  data: {
    _id?: string
    form_number?: string
    owner_id?: string
    owner?: IOwner
    group_id?: string
    group?: IOwner
    placement?: {
      policy_number?: string
      base_date?: number
      date?: string
      term?: number
      maturity_date?: string
      bank_id?: string
      bank?: IBank
      amount?: number
    }
    source?: {
      bank_id?: string
      bank_account_uuid?: string
      bank?: IBank
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
      bank?: IBank
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
      bank?: IBank
    }
    cashback_schedule?: {
      payment_date?: string
      rate?: number
      amount?: number
    }[]
    withdrawal?: {
      bank_id?: string
      bank_account_uuid?: string
      bank?: IBank
      received_date?: string
      received_amount?: number
      remaining_amount?: number
    }
    notes?: string
    is_archived?: boolean
    status?: 'draft' | 'active' | 'withdrawn' | 'renewed'
    created_at?: Date
    created_by?: IAuthUser
  }[]
  pagination: {
    page: number
    page_count: number
    page_size: number
    total_document: number
  }
}

/**
 * Use case: Retrieve Insurances.
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
    const isAuthorized = this.deps.authorizationService.hasAccess(input.authUser.role?.permissions, 'insurances:read');
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
          owner: item.owner,
          group: item.group,
          placement: item.placement,
          source: item.source,
          interest: item.interest,
          interest_schedule: item.interest_schedule,
          cashback: item.cashback,
          cashback_schedule: item.cashback_schedule,
          notes: item.notes,
          withdrawal: item.withdrawal,
          is_archived: item.is_archived,
          status: item.status,
          created_at: item.created_at,
          created_by: {
            _id: item.created_by?._id,
            username: item.created_by?.username,
            name: item.created_by?.name,
            email: item.created_by?.email,
          },
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
