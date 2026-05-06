const fs = require('fs');
const path = require('path');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}
const files = walk('./src');
let changedCount = 0;
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('appointments')) {
    const newContent = content.replace(/["']appointments["']/g, '"customer_bookings"');
    if (content !== newContent) {
      fs.writeFileSync(file, newContent, 'utf8');
      changedCount++;
      console.log('Updated: ' + file);
    }
  }
});
console.log('Total files changed: ' + changedCount);
