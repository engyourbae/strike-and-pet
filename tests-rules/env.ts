import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const PROJECT_ID = 'demo-strike-pet';

export function createEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    database: { rules: readFileSync('database.rules.json', 'utf8') },
  });
}

export const GROUP = 'GROUPAAAAAAAAAAAAAAA'; // 20 karakter alfanumerik (format id grup)
export const MEDIA = 'MEDIAAAAAAAAAAAAAAAA';
export const PAIR = 'alice_bob';
