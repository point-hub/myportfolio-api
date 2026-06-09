import { BaseUseCase, type IQuery, type IUseCaseOutputFailed, type IUseCaseOutputSuccess } from '@point-hub/papi';

import apiConfig from '@/config/api';
import type { IAuthorizationService } from '@/modules/_shared/services/authorization.service';
import type { IAuthUser } from '@/modules/master/users/interface';

export interface IInput {
  authUser: IAuthUser
  query: IQuery
}

export interface IDeps {
  authorizationService: IAuthorizationService
}

export interface ISuccessData {
  url: string
  expires_at: string
}

export class ExportCashflowsUseCase extends BaseUseCase<IInput, IDeps, ISuccessData> {
  async handle(input: IInput): Promise<IUseCaseOutputSuccess<ISuccessData> | IUseCaseOutputFailed> {
    const isAuthorized = this.deps.authorizationService.hasAccess(input.authUser.role?.permissions, 'deposits:read');
    if (!isAuthorized) {
      return this.fail({ code: 403, message: 'You do not have permission to perform this action.' });
    }

    const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000));
    const token = Buffer.from(JSON.stringify({
      exp: expiresAt.getTime(),
      query: input.query,
    })).toString('base64url');

    return this.success({
      url: `${apiConfig.baseUrl}/v1/deposits/cashflows/export-download?token=${token}`,
      expires_at: expiresAt.toISOString(),
    });
  }
}
