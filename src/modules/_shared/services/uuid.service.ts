import { randomUUIDv5, randomUUIDv7 } from 'bun';

export interface IUuidService {
  v5(name: string, namespace: string): string;
  v7(): string;
}

// UUID v5 (name-based, deterministic)
export const v5 = (name: string, namespace = 'dns'): string => {
  return randomUUIDv5(name, namespace);
};

// UUID v7 (time-ordered, random)
export const v7 = (): string => {
  return randomUUIDv7();
};

export const UuidService: IUuidService = {
  v5,
  v7,
};

