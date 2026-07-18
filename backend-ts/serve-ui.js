const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/test-ui.html') {
    fs.readFile(path.join(__dirname, 'test-ui.html'), 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading test-ui.html');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`\n🎨 Test UI Server running at http://localhost:${PORT}`);
  console.log(`📱 Open http://localhost:${PORT} in your browser\n`);
  console.log(`Make sure the backend is running on port 3000!`);
  console.log(`Backend command: npm run dev\n`);
});
