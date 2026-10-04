import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { initializeSchema } from './schema';

export function openDatabase(path: string): DatabaseSync {
  if (!path || !isAbsolute(path)) throw new Error('DATABASE_PATH must be absolute');
  const resolved = resolve(path);
  if (process.env.NODE_ENV === 'test' && !resolved.startsWith(resolve(tmpdir()) + sep)) {
    throw new Error('Tests may only open databases in the system temporary directory');
  }
  mkdirSync(dirname(resolved), { recursive: true });
  const db = new DatabaseSync(resolved);
  try {
    initializeSchema(db);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
