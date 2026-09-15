import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const saccoRoot = path.resolve(here, '../..');
const serverRoot = path.resolve(here, '..');

dotenv.config({ path: path.join(saccoRoot, '.env') });
dotenv.config({ path: path.join(serverRoot, '.env') });
