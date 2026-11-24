const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://mohaktools.com';
const PUBLIC_DIR = './'; // Change to './dist' or './build' if you use a build folder

function getHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    if (['.git', 'node_modules', '.github'].includes(file)) return;
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getHtmlFiles(filePath, fileList);
    } else if (file.endsWith('.html') && file !== '404.html') {
      let route = filePath.replace(/\\/g, '/').replace(/index\.html$/, '');
      if (!route.startsWith('/')) route = '/' + route;
      fileList.push(route);
    }
  });
  return fileList;
}

const routes = getHtmlFiles(PUBLIC_DIR);
const today = new Date().toISOString().split('T')[0];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://sitemaps.org">
${routes
  .map(
    (route) => `  <url>
    <loc>${BASE_URL}${route}</loc>
    <lastmod>${today}</lastmod>
  </url>`
  )
  .join('\n')}
</urlset>`;

fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), sitemap);
console.log(`Generated sitemap.xml with ${routes.length} URLs!`);
