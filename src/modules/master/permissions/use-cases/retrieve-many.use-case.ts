import { BaseUseCase, type IQuery, type IUseCaseOutputFailed, type IUseCaseOutputSuccess } from '@point-hub/papi';

import { getPermissions } from '@/modules/_shared/data/permissions';
import type { IAuthorizationService } from '@/modules/_shared/services/authorization.service';
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
    name?: string
    created_at?: Date
  }[]
  pagination: {
    page: number
    page_count: number
    page_size: number
    total_document: number
  }
}

type IPermissionOutput = ISuccessData['data'][number];

/**
 * Use case: Retrieve Roles.
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
    const isAuthorized =
      this.deps.authorizationService.hasAccess(input.authUser.role?.permissions, 'roles:create')
      || this.deps.authorizationService.hasAccess(input.authUser.role?.permissions, 'roles:update');
    if (!isAuthorized) {
      return this.fail({ code: 403, message: 'You do not have permission to perform this action.' });
    }

    // Retrieve all data from the database.
    const response = await this.deps.retrieveManyRepository.handle(input.query);

    // Optionally filter response fields using `query.fields`.
    const fields = typeof input.query.fields === 'string'
      ? input.query.fields.split(',').map(f => f.trim())
      : null;

    const permissionsByName = new Map<string, IPermissionOutput>(
      response.data.map(item => [item.name, item]),
    );

    for (const name of getPermissions()) {
      if (!this.matchesQuery(name, input.query)) continue;

      permissionsByName.set(name, {
        ...permissionsByName.get(name),
        name,
      });
    }

    // Return a success response.
    return this.success({
      data: Array.from(permissionsByName.values()).map(item => {
        const mapped = {
          _id: item._id,
          name: item.name,
          created_at: item.created_at,
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

  private matchesQuery(name: string, query: IQuery): boolean {
    const searchAll = query?.['search.all'];
    if (typeof searchAll === 'string' && !name.toLowerCase().includes(searchAll.toLowerCase())) {
      return false;
    }

    const searchName = query?.['search.name'];
    if (typeof searchName === 'string' && name !== searchName) {
      return false;
    }

    return true;
  }
}
