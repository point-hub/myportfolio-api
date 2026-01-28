import { BaseUseCase, type IUseCaseOutputFailed, type IUseCaseOutputSuccess } from '@point-hub/papi';

import type { IAuthorizationService } from '@/modules/_shared/services/authorization.service';
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
  code: string
  name: string
  branch?: string
  address?: string
  phone?: string
  account_number?: string
  account_name?: string
  notes?: string
  is_archived: boolean
  created_at: Date
  created_by: IAuthUser
}

/**
 * Use case: Retrieve Broker.
 *
 * Responsibilities:
 * - Check whether the user is authorized to perform this action
 * - Retrieve a single data record from the database.
 * - Return a success response.
 */
export class RetrieveUseCase extends BaseUseCase<IInput, IDeps, ISuccessData> {
  async handle(input: IInput): Promise<IUseCaseOutputSuccess<ISuccessData> | IUseCaseOutputFailed> {
    // Check whether the user is authorized to perform this action
    const isAuthorized = this.deps.authorizationService.hasAccess(input.authUser.role?.permissions, 'brokers:read');
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
      code: response.code,
      name: response.name,
      branch: response.branch,
      address: response.address,
      phone: response.phone,
      account_number: response.account_number,
      account_name: response.account_name,
      notes: response.notes,
      is_archived: response.is_archived,
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
