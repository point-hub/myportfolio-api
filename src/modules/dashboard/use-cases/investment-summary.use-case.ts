import { BaseUseCase, type IQuery, type IUseCaseOutputFailed, type IUseCaseOutputSuccess } from '@point-hub/papi';

import type { IAuthorizationService } from '@/modules/_shared/services/authorization.service';
import type { IAuthUser } from '@/modules/master/users/interface';

import type { IInvestmentSummaryOutput, IInvestmentSummaryRepository } from '../repositories/investment-summary.repository';

export interface IInput {
  authUser: IAuthUser
  query: IQuery
}

export interface IDeps {
  investmentSummaryRepository: IInvestmentSummaryRepository
  authorizationService: IAuthorizationService
}

export class InvestmentSummaryUseCase extends BaseUseCase<IInput, IDeps, IInvestmentSummaryOutput> {
  async handle(input: IInput): Promise<IUseCaseOutputSuccess<IInvestmentSummaryOutput> | IUseCaseOutputFailed> {
    const isAuthorized = this.deps.authorizationService.hasAccess(input.authUser.role?.permissions, 'dashboard:read');
    if (!isAuthorized) {
      return this.fail({ code: 403, message: 'You do not have permission to perform this action.' });
    }

    const response = await this.deps.investmentSummaryRepository.handle(input.query);

    return this.success(response);
  }
}
