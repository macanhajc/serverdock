import { randomUUID } from 'crypto';
import { join } from 'path';
import { tmpdir } from 'os';

// Runs before every test file's imports, so db.js never opens the real
// serverdock.db and auth code has a JWT_SECRET to sign/verify against.
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-jwt-secret';
// Unique per test file (each gets its own module registry) so parallel test
// files never share/collide on the same settings.json.
process.env.SETTINGS_PATH = join(tmpdir(), `serverdock-test-settings-${randomUUID()}.json`);
