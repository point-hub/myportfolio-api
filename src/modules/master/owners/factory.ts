import { faker } from '@faker-js/faker';
import { BaseFactory, type IDatabase } from '@point-hub/papi';

import { type IOwner } from './interface';
import { CreateRepository } from './repositories/create.repository';
import { CreateManyRepository } from './repositories/create-many.repository';

export default class OwnerFactory extends BaseFactory<IOwner> {
  constructor(public dbConnection: IDatabase, public options?: Record<string, unknown>) {
    super();
  }

  definition() {
    return {
      code: 'OWNER/' + faker.number.int({ min: 1, max: 99999 }).toString().padStart(5, '0'),
      name: faker.person.fullName(),
      notes: faker.lorem.words(),
      is_archived: false,
      created_at: new Date(),
      created_by_id: undefined, // injected
    } as IOwner;
  }

  async create() {
    const createRepository = new CreateRepository(this.dbConnection, this.options);
    return await createRepository.handle(this.makeOne());
  }

  async createMany(count: number) {
    const createManyRepository = new CreateManyRepository(this.dbConnection, this.options);
    return await createManyRepository.handle(this.makeMany(count));
  }
}
