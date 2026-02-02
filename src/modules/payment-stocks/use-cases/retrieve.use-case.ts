import { BaseUseCase, type IUseCaseOutputFailed, type IUseCaseOutputSuccess } from '@point-hub/papi';

import type { IAuthorizationService } from '@/modules/_shared/services/authorization.service';
import type { IBroker } from '@/modules/master/brokers/interface';
import type { IAuthUser } from '@/modules/master/users/interface';
import type { IStock } from '@/modules/stocks/interface';

import type { IPaymentStock } from '../interface';
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

export interface ISuccessData extends IPaymentStock {
  form_number?: string
  broker_id?: string
  broker?: IBroker
  payment_date?: string
  transactions?: {
    uuid?: string
    stock_id?: string
    stock?: IStock
    transaction_number?: number
    date?: number
    amount?: number
  }[]
  created_by?: IAuthUser
  updated_by?: IAuthUser
  archived_by?: IAuthUser
}

/**
 * Use case: Retrieve Payment Stock.
 *
 * Responsibilities:
 * - Check whether the user is authorized to perform this action
 * - Retrieve a single data record from the database.
 * - Return a success response.
 */
export class RetrieveUseCase extends BaseUseCase<IInput, IDeps, ISuccessData> {
  async handle(input: IInput): Promise<IUseCaseOutputSuccess<ISuccessData> | IUseCaseOutputFailed> {
    // Check whether the user is authorized to perform this action
    const isAuthorized = this.deps.authorizationService.hasAccess(input.authUser.role?.permissions, 'payment-stocks:read');
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
      payment_date: response.payment_date,
      broker_id: response.broker_id,
      broker: response.broker,
      transactions: response.transactions,
      total: response.total,
      notes: response.notes,
      status: response.status,
      is_archived: response.is_archived,
    });
  }
}
