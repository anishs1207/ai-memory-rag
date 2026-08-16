import * as dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Load Blinky's private environment independently of the shell launch directory. */
export function loadBlinkyEnvironment(moduleUrl: string = import.meta.url): string {
  const compiledModuleDirectory = path.dirname(fileURLToPath(moduleUrl));
  const environmentPath = path.resolve(compiledModuleDirectory, '..', '.env');
  dotenv.config({ path: environmentPath, quiet: true });
  return environmentPath;
}
