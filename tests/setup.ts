import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DATABASE_PATH = join(tmpdir(), `student-unit-${randomUUID()}.sqlite`);
