#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');

const ROOT_DIR = path.resolve(__dirname, '..');
const DSL_CARGO = path.join(ROOT_DIR, 'dsl', 'Cargo.toml');
const PAGES_SRC = path.join(ROOT_DIR, 'playground', 'src', 'frontend', 'pages');
const PAGES_DEST = path.join(ROOT_DIR, 'playground', 'src', 'frontend', 'pages-build');
const BUNDLE_SRC = path.join(PAGES_DEST, 'client.mjs');
const BUNDLE_DEST = path.join(ROOT_DIR, 'playground', 'dist', 'bundle.js');
const BACKEND_MAIN = path.join(ROOT_DIR, 'playground', 'src', 'backend', 'main.cjs');

console.log('=== Bstack Development Dev Server CLI ===');

let serverProcess = null;

function startServer() {
  if (serverProcess) {
    serverProcess.kill();
  }
  
  console.log('[cli] Starting backend server...');
  serverProcess = spawn('node', [BACKEND_MAIN], {
    cwd: path.join(ROOT_DIR, 'playground'),
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' }
  });
  
  serverProcess.on('close', (code) => {
    if (code !== null && code !== 0) {
      console.log(`[cli] Server process exited with code ${code}`);
    }
  });
}

function compileDSL() {
  return new Promise((resolve) => {
    console.log('[cli] Compiling JSS templates with Rust DSL compiler...');
    
    // Check if Cargo is in path by running cargo --version
    exec('cargo --version', (err) => {
      if (err) {
        console.warn('[cli] WARNING: Rust/Cargo not found. Skipping template compilation.');
        return resolve(false);
      }
      
      const cmd = `cargo run --manifest-path "${DSL_CARGO}" -- "${PAGES_SRC}" "${PAGES_DEST}"`;
      exec(cmd, (compileErr, stdout, stderr) => {
        if (compileErr) {
          console.error('[cli] Compilation error:', stderr || compileErr.message);
          return resolve(false);
        }
        console.log('[cli] Templates compiled successfully.');
        resolve(true);
      });
    });
  });
}

function runRollup() {
  return new Promise((resolve) => {
    if (!fs.existsSync(BUNDLE_SRC)) {
      console.log('[cli] client.mjs not found, skipping Rollup bundle.');
      return resolve(false);
    }
    
    console.log('[cli] Bundling client components with Rollup...');
    const cmd = `npx rollup -c -f es -i "${BUNDLE_SRC}" -o "${BUNDLE_DEST}"`;
    exec(cmd, { cwd: path.join(ROOT_DIR, 'playground') }, (err, stdout, stderr) => {
      if (err) {
        console.error('[cli] Rollup error:', stderr || err.message);
        return resolve(false);
      }
      console.log('[cli] Client bundle updated.');
      resolve(true);
    });
  });
}

function copyStaticFiles() {
  // Copy css and mjs files from PAGES_DEST to dist
  const destDir = path.join(ROOT_DIR, 'playground', 'dist');
  if (!fs.existsSync(PAGES_DEST)) return;
  
  const files = fs.readdirSync(PAGES_DEST);
  files.forEach(file => {
    if (file.endsWith('.mjs') && file !== 'client.mjs') {
      const srcPath = path.join(PAGES_DEST, file);
      const destPath = path.join(destDir, file);
      fs.copyFileSync(srcPath, destPath);
      console.log(`[cli] Copied component: ${file} => playground/dist/${file}`);
    }
  });
  
  const stylesSrc = path.join(PAGES_DEST, 'styles');
  const stylesDest = path.join(destDir, 'styles');
  if (fs.existsSync(stylesSrc)) {
    if (!fs.existsSync(stylesDest)) {
      fs.mkdirSync(stylesDest, { recursive: true });
    }
    fs.readdirSync(stylesSrc).forEach(file => {
      fs.copyFileSync(path.join(stylesSrc, file), path.join(stylesDest, file));
      console.log(`[cli] Copied stylesheet: ${file} => playground/dist/styles/${file}`);
    });
  }
}

async function triggerRebuild() {
  const compiled = await compileDSL();
  if (compiled) {
    await runRollup();
    copyStaticFiles();
  }
}

async function main() {
  // Run initial compile
  await triggerRebuild();
  
  // Start node server
  startServer();
  
  // Watch files
  console.log(`[cli] Watching JSS files in ${PAGES_SRC}...`);
  const watcher = chokidar.watch(PAGES_SRC, { ignoreInitial: true });
  
  watcher.on('all', async (event, filePath) => {
    console.log(`[cli] File change detected (${event}): ${path.basename(filePath)}`);
    await triggerRebuild();
  });
  
  process.on('SIGINT', () => {
    console.log('[cli] Stopping watcher and server...');
    watcher.close();
    if (serverProcess) {
      serverProcess.kill();
    }
    process.exit(0);
  });
}

main().catch(err => {
  console.error('[cli] Critical error in CLI:', err);
});
