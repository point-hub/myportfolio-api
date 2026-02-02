import { BaseUseCase, type IUseCaseOutputFailed, type IUseCaseOutputSuccess } from '@point-hub/papi';

import type { IAuthorizationService } from '@/modules/_shared/services/authorization.service';
import type { IBroker } from '@/modules/master/brokers/interface';
import type { IIssuer } from '@/modules/master/issuers/interface';
import type { IOwner } from '@/modules/master/owners/interface';
import type { IAuthUser } from '@/modules/master/users/interface';

import type { IStock } from '../interface';
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

export interface ISuccessData extends IStock {
  broker?: IBroker
  owner?: IOwner
  buying_list?: {
    uuid?: string
    issuer_id?: string
    ssuer?: IIssuer
    lots?: number
    shares?: number
    price?: number
    total?: number
  }[]
  selling_list?: {
    uuid?: string
    issuer_id?: string
    ssuer?: IIssuer
    lots?: number
    shares?: number
    price?: number
    total?: number
  }[]
  created_by?: IAuthUser
  updated_by?: IAuthUser
  archived_by?: IAuthUser
}

/**
 * Use case: Retrieve Stock.
 *
 * Responsibilities:
 * - Check whether the user is authorized to perform this action
 * - Retrieve a single data record from the database.
 * - Return a success response.
 */
export class RetrieveUseCase extends BaseUseCase<IInput, IDeps, ISuccessData> {
  async handle(input: IInput): Promise<IUseCaseOutputSuccess<ISuccessData> | IUseCaseOutputFailed> {
    // Check whether the user is authorized to perform this action
    const isAuthorized = this.deps.authorizationService.hasAccess(input.authUser.role?.permissions, 'stocks:read');
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
      transaction_date: response.transaction_date,
      settlement_date: response.settlement_date,
      broker_id: response.broker_id,
      broker: response.broker,
      transaction_number: response.transaction_number!,
      owner_id: response.owner_id,
      owner: response.owner,
      buying_list: response.buying_list,
      selling_list: response.selling_list,
      buying_total: response.buying_total,
      buying_brokerage_fee: response.buying_brokerage_fee,
      buying_vat: response.buying_vat,
      buying_levy: response.buying_levy,
      buying_kpei: response.buying_kpei,
      buying_stamp: response.buying_stamp,
      buying_proceed: response.buying_proceed,
      selling_total: response.selling_total,
      selling_brokerage_fee: response.selling_brokerage_fee,
      selling_vat: response.selling_vat,
      selling_levy: response.selling_levy,
      selling_kpei: response.selling_kpei,
      selling_stamp: response.selling_stamp,
      selling_proceed: response.selling_proceed,
      proceed_amount: response.proceed_amount,
      notes: response.notes,
      status: response.status,
      is_archived: response.is_archived,
    });
  }
}
