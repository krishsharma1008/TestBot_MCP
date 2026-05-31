#!/usr/bin/env node
const HealixMCPServer = require('../src/index.js');
const {
  runCancelFromCli,
  runDeleteFromCli,
  runStatusFromCli,
  runTestMyAppFromCli,
  runWatchFromCli,
  usage,
} = require('../src/cli.js');

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command) {
    const server = new HealixMCPServer();
    await server.start();
    return;
  }

  if (command === 'test-my-app') {
    await runTestMyAppFromCli(HealixMCPServer, args);
    return;
  }

  if (command === 'status') {
    runStatusFromCli(args);
    return;
  }

  if (command === 'watch') {
    await runWatchFromCli(args);
    return;
  }

  if (command === 'cancel' || command === 'stop') {
    runCancelFromCli(args);
    return;
  }

  if (command === 'delete') {
    runDeleteFromCli(args);
    return;
  }

  if (command === '--help' || command === '-h' || command === 'help') {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  throw new Error(`Unknown command: ${command}\n\n${usage()}`);
}

main().catch((err) => {
  console.error('[healix-mcp] failed:', err.message || err);
  process.exit(1);
});