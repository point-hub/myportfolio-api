import type { IDatabase, IDocument } from '@point-hub/papi';

import { collectionName } from '../entity';

export interface IDeleteInterestRepository {
  handle(_id: string,
    document: IDocument,
    arrayFilters: IDocument[],
  ): Promise<IDeleteInterestOutput>
}

export interface IDeleteInterestOutput {
  matched_count: number
  modified_count: number
}

export class DeleteInterestRepository implements IDeleteInterestRepository {
  constructor(
    public database: IDatabase,
    public options?: IDocument,
  ) { }

  async handle(_id: string,
    document: IDocument,
    arrayFilters: IDocument[],
  ): Promise<IDeleteInterestOutput> {
    return await this.database.collection(collectionName).updateOne({ _id },
      { $unset: document },
      {
        ...this.options,
        arrayFilters,
      },
    );
  }
}