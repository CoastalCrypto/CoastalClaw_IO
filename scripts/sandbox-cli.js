#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const RESULTS_DIR = path.join(process.cwd(), 'test-artifacts');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const SANDBOX_ID = `sandbox-${TIMESTAMP}`;
const SANDBOX_PORT = 5174; // Avoid conflict with default 5173

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getRunningContainers() {
  try {
    const output = execSync('docker ps --filter "name=coastal-ai-sandbox" --format "{{.Names}}"', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    return output ? output.split('\n') : [];
  } catch {
    return [];
  }
}

function start() {
  console.log(`\n🚀 Starting Coastal.AI sandbox (${SANDBOX_ID})...`);

  ensureDir(RESULTS_DIR);
  const sandboxDir = path.join(RESULTS_DIR, SANDBOX_ID);
  ensureDir(sandboxDir);

  const env = {
    ...process.env,
    SANDBOX_ID,
    SANDBOX_PORT,
    SANDBOX_RESULTS_DIR: sandboxDir,
    CC_OLLAMA_URL: process.env.CC_OLLAMA_URL || 'http://host.docker.internal:11434',
  };

  console.log(`📁 Results will be saved to: ${sandboxDir}`);
  console.log(`🔌 Web UI will run on: http://localhost:${SANDBOX_PORT}`);

  const proc = spawn('docker compose', ['-f', 'docker-compose.test.yml', 'up'], {
    env,
    stdio: 'inherit',
    shell: true, // Needed for Windows if calling "docker compose" as one command
  });

  proc.on('exit', (code) => {
    if (code === 0) {
      console.log(`\n✅ Sandbox stopped gracefully. Results saved to: ${sandboxDir}`);
    } else {
      console.log(`\n❌ Sandbox exited with code ${code}`);
    }
  });
}

function stop() {
  console.log('\n⏹️  Stopping sandbox...');

  const containers = getRunningContainers();
  if (containers.length === 0) {
    console.log('No running sandboxes found.');
    return;
  }

  containers.forEach((container) => {
    console.log(`Stopping ${container}...`);
    execSync(`docker compose -f docker-compose.test.yml down`, {
      stdio: 'inherit',
    });
  });

  console.log('✅ Sandbox stopped. Results preserved in test-artifacts/');
}

function clean() {
  console.log('\n🗑️  Cleaning test artifacts...');

  if (!fs.existsSync(RESULTS_DIR)) {
    console.log('No test artifacts found.');
    return;
  }

  const count = fs.readdirSync(RESULTS_DIR).length;
  console.log(`Found ${count} sandbox results. Removing...`);
  // Cross-platform cleanup
  if (process.platform === 'win32') {
    execSync(`rmdir /s /q "${RESULTS_DIR}"`, { stdio: 'inherit' });
  } else {
    execSync(`rm -rf "${RESULTS_DIR}"`, { stdio: 'inherit' });
  }
  console.log('✅ Cleaned.');
}

function logs() {
  console.log('\n📋 Latest sandbox logs...');

  if (!fs.existsSync(RESULTS_DIR)) {
    console.log('No test artifacts found.');
    return;
  }

  const dirs = fs.readdirSync(RESULTS_DIR).sort().reverse();
  if (dirs.length === 0) {
    console.log('No sandbox runs found.');
    return;
  }

  const latest = path.join(RESULTS_DIR, dirs[0]);
  const coreLog = path.join(latest, 'core.log');

  if (fs.existsSync(coreLog)) {
    console.log(`\n=== Core API Log (${dirs[0]}) ===`);
    console.log(fs.readFileSync(coreLog, 'utf8'));
  }
}

function status() {
  console.log('\n📊 Sandbox Status');

  const containers = getRunningContainers();
  if (containers.length === 0) {
    console.log('No running sandboxes.');
  } else {
    console.log(`Running sandboxes: ${containers.join(', ')}`);
  }

  if (fs.existsSync(RESULTS_DIR)) {
    const count = fs.readdirSync(RESULTS_DIR).length;
    console.log(`Stored results: ${count} sandbox runs`);
  }
}

const command = process.argv[2] || 'start';

switch (command) {
  case 'start':
    start();
    break;
  case 'stop':
    stop();
    break;
  case 'clean':
    clean();
    break;
  case 'logs':
    logs();
    break;
  case 'status':
    status();
    break;
  default:
    console.log(`Unknown command: ${command}`);
    console.log('Available commands: start, stop, clean, logs, status');
    process.exit(1);
}
