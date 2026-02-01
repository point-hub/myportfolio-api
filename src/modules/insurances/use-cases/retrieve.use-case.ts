import { BaseUseCase, type IUseCaseOutputFailed, type IUseCaseOutputSuccess } from '@point-hub/papi';

import type { IAuthorizationService } from '@/modules/_shared/services/authorization.service';
import type { IBank } from '@/modules/master/banks/interface';
import type { IOwner } from '@/modules/master/owners/interface';
import type { IAuthUser } from '@/modules/master/users/interface';

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

export interface ISuccessData {
  _id: string
  form_number?: string
  owner_id?: string
  owner?: IOwner
  group_id?: string
  group?: IOwner
  placement?: {
    bank_id?: string
    bank?: IBank
    policy_number?: string
    base_date?: number
    date?: string
    term?: number
    maturity_date?: string
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
    received_date?: string
    received_amount?: number
    remaining_amount?: number
    bank_id?: string
    bank_account_uuid?: string
    bank?: IBank
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
    received_date?: string
    received_amount?: number
    remaining_amount?: number
    bank_id?: string
    bank_account_uuid?: string
    bank?: IBank
  }[]
  withdrawal?: {
    received_date?: string
    received_amount?: number
    remaining_amount?: number
    bank_id?: string
    bank_account_uuid?: string
    bank?: IBank
  }
  notes: string
  is_archived: boolean
  status?: 'draft' | 'active' | 'withdrawn' | 'renewed'
  created_at: Date
  created_by: IAuthUser
}

/**
 * Use case: Retrieve Insurance.
 *
 * Responsibilities:
 * - Check whether the user is authorized to perform this action
 * - Retrieve a single data record from the database.
 * - Return a success response.
 */
export class RetrieveUseCase extends BaseUseCase<IInput, IDeps, ISuccessData> {
  async handle(input: IInput): Promise<IUseCaseOutputSuccess<ISuccessData> | IUseCaseOutputFailed> {
    // Check whether the user is authorized to perform this action
    const isAuthorized = this.deps.authorizationService.hasAccess(input.authUser.role?.permissions, 'insurances:read');
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
      owner_id: response.owner_id,
      owner: response.owner,
      group_id: response.group_id,
      group: response.group,
      placement: response.placement,
      source: response.source,
      interest: response.interest,
      interest_schedule: response.interest_schedule,
      cashback: response.cashback,
      cashback_schedule: response.cashback_schedule,
      withdrawal: response.withdrawal,
      notes: response.notes,
      is_archived: response.is_archived,
      status: response.status,
      created_at: response.created_at,
      created_by: {
        _id: response.created_by?._id,
        username: response.created_by?.username,
        name: response.created_by?.name,
        email: response.created_by?.email,
      },
    });
  }
}
