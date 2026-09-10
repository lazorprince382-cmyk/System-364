/**
 * Load Finance env from common local locations (first wins for each key).
 * Collaborators may keep secrets in finance/.env or finance/server/.env.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const financeRoot = path.resolve(here, '../..');
const serverRoot = path.resolve(here, '..');

dotenv.config({ path: path.join(financeRoot, '.env') });
dotenv.config({ path: path.join(serverRoot, '.env') });
