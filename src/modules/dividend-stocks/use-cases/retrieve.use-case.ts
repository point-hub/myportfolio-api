import { BaseUseCase, type IUseCaseOutputFailed, type IUseCaseOutputSuccess } from '@point-hub/papi';

import type { IAuthorizationService } from '@/modules/_shared/services/authorization.service';
import type { IBank } from '@/modules/master/banks/interface';
import type { IBroker } from '@/modules/master/brokers/interface';
import type { IIssuer } from '@/modules/master/issuers/interface';
import type { IOwner } from '@/modules/master/owners/interface';
import type { IAuthUser } from '@/modules/master/users/interface';

import type { IDividendStock } from '../interface';
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

export interface ISuccessData extends IDividendStock {
  _id?: string
  form_number?: string
  broker_id?: string
  broker?: IBroker
  bank_id?: string
  bank?: IBank
  bank_account_uuid?: string
  dividend_date?: string
  transactions?: {
    uuid?: string
    issuer_id?: string
    issuer?: IIssuer
    owner_id?: string
    owner?: IOwner
    dividend_date?: string
    shares?: number
    dividend_amount?: number
    total_amount?: number
    received_amount?: number
  }[]
  total_received?: number
  created_by?: IAuthUser
  updated_by?: IAuthUser
  archived_by?: IAuthUser
}

/**
 * Use case: Retrieve Dividend Stock.
 *
 * Responsibilities:
 * - Check whether the user is authorized to perform this action
 * - Retrieve a single data record from the database.
 * - Return a success response.
 */
export class RetrieveUseCase extends BaseUseCase<IInput, IDeps, ISuccessData> {
  async handle(input: IInput): Promise<IUseCaseOutputSuccess<ISuccessData> | IUseCaseOutputFailed> {
    // Check whether the user is authorized to perform this action
    const isAuthorized = this.deps.authorizationService.hasAccess(input.authUser.role?.permissions, 'dividend-stocks:read');
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
      dividend_date: response.dividend_date,
      broker_id: response.broker_id,
      broker: response.broker,
      bank_id: response.bank_id,
      bank_account_uuid: response.bank_account_uuid,
      bank: response.bank,
      transactions: response.transactions,
      total_received: response.total_received,
      notes: response.notes,
      status: response.status,
      is_archived: response.is_archived,
    });
  }
}
