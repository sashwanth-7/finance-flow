const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function findDir(dirName) {
  const directPath = path.join(__dirname, dirName);
  if (fs.existsSync(directPath)) return directPath;
  const nestedPath = path.join(__dirname, 'Finance-App-main', dirName);
  if (fs.existsSync(nestedPath)) return nestedPath;
  return null;
}

const backendDir = findDir('backend');
const frontendDir = findDir('frontend');

if (!backendDir || !frontendDir) {
  console.error('Error: Could not locate backend or frontend directory.');
  process.exit(1);
}

console.log('🚀 Starting LoanFlowPro Backend & Frontend servers...');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

const backendProcess = spawn(npmCmd, ['run', 'dev'], { cwd: backendDir, stdio: 'inherit', shell: true });
const frontendProcess = spawn(npmCmd, ['run', 'dev'], { cwd: frontendDir, stdio: 'inherit', shell: true });

process.on('SIGINT', () => {
  backendProcess.kill();
  frontendProcess.kill();
  process.exit();
});
