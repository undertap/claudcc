#!/usr/bin/env node

const { startServer } = require('../server');
const { installHook, uninstallHook } = require('../hook/install');

const args = process.argv.slice(2);
const cmd = args[0];

const getFlag = (name, fallback) => {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  return args[i + 1];
};

const hasFlag = (name) => args.includes(name);

if (cmd === '--version' || cmd === '-v') {
  console.log(require('../package.json').version);
  process.exit(0);
}

if (cmd === '--help' || cmd === '-h') {
  console.log(`cc-doctor — is your Claude Code setup optimal?

Usage:
  cc-doctor                   Start the dashboard (opens browser)
  cc-doctor install-hook      Install the session-rater Stop hook
  cc-doctor uninstall-hook    Remove the session-rater hook
  cc-doctor --port <n>        Serve on a specific port (default: 7337)
  cc-doctor --no-open         Don't auto-open the browser
  cc-doctor --version         Print version
`);
  process.exit(0);
}

if (cmd === 'install-hook') {
  installHook().then(
    () => process.exit(0),
    (err) => { console.error(err.message || err); process.exit(1); }
  );
  return;
}

if (cmd === 'uninstall-hook') {
  uninstallHook().then(
    () => process.exit(0),
    (err) => { console.error(err.message || err); process.exit(1); }
  );
  return;
}

const port = parseInt(getFlag('--port', '7337'), 10);
const shouldOpen = !hasFlag('--no-open');

startServer({ port, shouldOpen }).catch((err) => {
  console.error('Failed to start cc-doctor:', err.message || err);
  process.exit(1);
});
