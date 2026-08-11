import fs from 'fs';
import path from 'path';

function searchFiles(dir, results = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'build') {
        searchFiles(fullPath, results);
      }
    } else if (/\.(js|jsx|ts|tsx)$/.test(file)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('process.env')) {
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes('process.env')) {
            results.push({ file: fullPath, line: idx + 1, text: line.trim() });
          }
        });
      }
    }
  }
  return results;
}

const matches = searchFiles('C:/Users/fredd/.gemini/antigravity/neo-app/ovrload-web/src');
console.log('Matches for process.env in src:', matches);
