import { BaseUseCase, type IQuery, type IUseCaseOutputFailed, type IUseCaseOutputSuccess } from '@point-hub/papi';

import type { IAuthorizationService } from '@/modules/_shared/services/authorization.service';
import type { IAuthUser } from '@/modules/master/users/interface';

import type { ICashflowOutput, IRetrieveCashflowsRepository } from '../repositories/retrieve-cashflows.repository';

export interface IInput {
  authUser: IAuthUser
  query: IQuery
}

export interface IDeps {
  retrieveCashflowsRepository: IRetrieveCashflowsRepository
  authorizationService: IAuthorizationService
}

export interface ISuccessData {
  data: ICashflowOutput[]
  pagination: {
    page: number
    page_count: number
    page_size: number
    total_document: number
  }
}

export class RetrieveCashflowsUseCase extends BaseUseCase<IInput, IDeps, ISuccessData> {
  async handle(input: IInput): Promise<IUseCaseOutputSuccess<ISuccessData> | IUseCaseOutputFailed> {
    const isAuthorized = this.deps.authorizationService.hasAccess(input.authUser.role?.permissions, 'deposits:read');
    if (!isAuthorized) {
      return this.fail({ code: 403, message: 'You do not have permission to perform this action.' });
    }

    const response = await this.deps.retrieveCashflowsRepository.handle(input.query);

    return this.success({
      data: response.data,
      pagination: response.pagination,
    });
  }
}
