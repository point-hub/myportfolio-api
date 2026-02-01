import type { IDatabase, IDocument } from '@point-hub/papi';

import { collectionName } from '../entity';

export interface IDeleteCashbackRepository {
  handle(_id: string,
    document: IDocument,
    arrayFilters: IDocument[],
  ): Promise<IDeleteCashbackOutput>
}

export interface IDeleteCashbackOutput {
  matched_count: number
  modified_count: number
}

export class DeleteCashbackRepository implements IDeleteCashbackRepository {
  constructor(
    public database: IDatabase,
    public options?: IDocument,
  ) { }

  async handle(_id: string,
    document: IDocument,
    arrayFilters: IDocument[],
  ): Promise<IDeleteCashbackOutput> {
    return await this.database.collection(collectionName).updateOne({ _id },
      { $unset: document },
      {
        ...this.options,
        arrayFilters,
      },
    );
  }
}