#!/usr/bin/env node
/**
 * @file free-coding-models.js
 * @description Live terminal availability checker for coding LLM models with OpenCode & OpenClaw integration.
 */

// 📖 --dev mode: must set FCM_DEV before any module imports resolve daemon paths
if (process.argv.includes('--dev')) {
  process.env.FCM_DEV = '1'
}

import chalk from 'chalk';
import { parseArgs, TIER_LETTER_MAP } from '../src/core/utils.js';
import { loadConfig, saveConfig } from '../src/core/config.js';
import { ensureTelemetryConfig } from '../src/core/telemetry.js';
import { ensureFavoritesConfig } from '../src/core/favorites.js';
import { buildCliHelpText } from '../src/tui/cli-help.js';
import { ALT_LEAVE } from '../src/core/constants.js';
import { enforceMandatoryStartupUpdate, isPackageDevMode } from '../src/core/updater.js';
import { runApp } from '../src/tui/app.js';

// Global error handlers to ensure terminal is restored if something crashes catastrophically
process.on('uncaughtException', (err) => {
  if (process.argv.some(arg => arg === '--daemon')) {
    console.error(err);
    return;
  }
  process.stdout.write(ALT_LEAVE);
  console.error(chalk.red('\n[Fatal Error] An unhandled exception occurred.'));
  console.error(err);
  console.error(chalk.yellow('\nPlease file an issue at https://github.com/vava-nessa/free-coding-models/issues or use the feedback form (I key) to report this to the author.'));
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  if (process.argv.some(arg => arg === '--daemon')) {
    console.error(reason);
    return;
  }
  process.stdout.write(ALT_LEAVE);
  console.error(chalk.red('\n[Fatal Error] An unhandled promise rejection occurred.'));
  console.error(reason);
  console.error(chalk.yellow('\nPlease file an issue at https://github.com/vava-nessa/free-coding-models/issues or use the feedback form (I key) to report this to the author.'));
  process.exit(1);
});

async function main() {
  const cliArgs = parseArgs(process.argv);

  if (cliArgs.helpMode) {
    console.log();
    console.log(buildCliHelpText({ chalk, title: 'free-coding-models' }));
    console.log();
    process.exit(0);
  }

  // Load JSON config before operational modes so the mandatory update policy can
  // 📖 persist failure counters for TUI, Web Dashboard, Docker daemon, and Desktop sidecar launches.
  const config = loadConfig();
  ensureTelemetryConfig(config);
  ensureFavoritesConfig(config);

  const isDevMode = isPackageDevMode();
  const shouldEnforceUpdate = !cliArgs.daemonStopMode && !cliArgs.daemonStatusMode;
  const startupUpdate = shouldEnforceUpdate
    ? await enforceMandatoryStartupUpdate(config, {
      saveConfig,
      isDevMode,
      surface: cliArgs.webMode ? 'web dashboard' : cliArgs.daemonMode ? 'router daemon' : 'TUI',
    })
    : { latestVersion: null, allowedOutdated: false, warningMessage: null, failures: 0, checked: false, updated: false, blocked: false };

  if (startupUpdate.updated) return;
  if (startupUpdate.blocked) process.exit(1);
  if (startupUpdate.allowedOutdated) {
    process.env.FCM_UPDATE_ALLOWED_OUTDATED = '1';
    process.env.FCM_UPDATE_LATEST_VERSION = startupUpdate.latestVersion || '';
    process.env.FCM_UPDATE_WARNING_MESSAGE = startupUpdate.warningMessage || '';
    process.env.FCM_UPDATE_FAILURES = String(startupUpdate.failures || 0);
  }

  // 📖 Standalone web dashboard: same full-catalog ping UI as the TUI, served
  // 📖 locally with Socket.IO/SSE/REST realtime updates.
  if (cliArgs.webMode) {
    const { startWebServer } = await import('../web/server.js');
    const parsedPort = Number.parseInt(process.env.FCM_WEB_PORT || process.env.FCM_PORT || '3333', 10);
    const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3333;
    await startWebServer(port, { open: true, startPingLoop: true, updateStatus: startupUpdate });
    return;
  }

  // 📖 Router daemon lifecycle flags run before the TUI so automation and
  // 📖 editor integrations can manage the local OpenAI-compatible endpoint.
  if (cliArgs.daemonMode || cliArgs.daemonBackgroundMode || cliArgs.daemonStopMode || cliArgs.daemonStatusMode) {
    const {
      getRouterDaemonStatus,
      runRouterDaemon,
      startRouterDaemonBackground,
      stopRouterDaemon,
    } = await import('../src/core/router-daemon.js');

    if (cliArgs.daemonMode) {
      await runRouterDaemon();
      return;
    }

    const result = cliArgs.daemonBackgroundMode
      ? await startRouterDaemonBackground()
      : cliArgs.daemonStopMode
        ? await stopRouterDaemon()
        : await getRouterDaemonStatus();

    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  }

  // 📖 --sync-set [name] — auto-discover, probe, and populate a router set
  if (cliArgs.syncSetMode) {
    const { syncSet } = await import('../src/core/sync-set.js');
    const result = await syncSet({ name: cliArgs.syncSetName || 'auto' });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  }

  // Validate --tier early, before entering alternate screen
  if (cliArgs.tierFilter && !TIER_LETTER_MAP[cliArgs.tierFilter]) {
    console.error(chalk.red(`  Unknown tier "${cliArgs.tierFilter}". Valid tiers: S, A, B, C`));
    process.exit(1);
  }

  await runApp(cliArgs, config, { startupUpdate, isDevMode });
}

main().catch((err) => {
  process.stdout.write(ALT_LEAVE);
  console.error(chalk.red('\n[Fatal Error]'));
  console.error(err);
  console.error(chalk.yellow('\nPlease file an issue at https://github.com/vava-nessa/free-coding-models/issues or use the feedback form (I key) to report this to the author.'));
  process.exit(1);
});
