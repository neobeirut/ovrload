const fs = require('fs');
const path = require('path');

function searchDir(dir, pattern) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (file !== 'node_modules' && file !== '.git' && file !== '.next') {
          searchDir(fullPath, pattern);
        }
      } else {
        if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.json') || file.endsWith('.env') || file.endsWith('.example') || file.endsWith('.local') || file.endsWith('.txt')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (pattern.test(content)) {
            console.log(`Found pattern in: ${fullPath}`);
            const lines = content.split('\n');
            lines.forEach((line, i) => {
              if (pattern.test(line)) {
                console.log(`  Line ${i+1}: ${line.trim()}`);
              }
            });
          }
        }
      }
    }
  } catch (e) {}
}

const pattern = /vercel\.app|neobeirut\.com|admin/i;
console.log("Searching for admin links or deployment urls...");
searchDir("C:\\Users\\fredd\\.gemini\\antigravity\\neo-app", pattern);
searchDir("C:\\Users\\fredd\\.gemini\\antigravity\\scratch", pattern);
