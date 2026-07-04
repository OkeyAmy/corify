import { loadDotEnv, configFromEnv } from '../lib/config.js';

loadDotEnv();

const config = configFromEnv();

if (!config.coralBaseUrl || !config.coralAuthKey) {
  process.stdout.write(
    'BLOCKED Coral schema check: set CORAL_BASE_URL and CORAL_AUTH_KEY in .env.\n'
  );
  process.exit(2);
}

const url = new URL('/api_v1.json', config.coralBaseUrl);
const res = await fetch(url, {
  headers: { Authorization: `Bearer ${config.coralAuthKey}` },
});
if (!res.ok) {
  process.stderr.write(
    `Coral schema fetch failed: ${String(res.status)} ${await res.text()}\n`
  );
  process.exit(1);
}

const schema = (await res.json()) as {
  openapi?: string;
  info?: { version?: string };
  paths?: Record<string, unknown>;
};
const paths = Object.keys(schema.paths ?? {});
process.stdout.write(
  `OK Coral schema openapi=${schema.openapi ?? 'unknown'} version=${schema.info?.version ?? 'unknown'}\n`
);
process.stdout.write(
  `${paths.filter((path) => /session|puppet|agent-rpc/i.test(path)).join('\n')}\n`
);
