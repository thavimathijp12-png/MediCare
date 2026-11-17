const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = __dirname;
const port = parseInt(process.env.PORT, 10) || 5501;
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8"
};

const server = http.createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }
  const requestedPath = (pathname === "/" || pathname === "") ? "/index.html" : pathname;
  const filename = path.resolve(root, `.${requestedPath}`);
  if (filename !== root && !filename.startsWith(root + path.sep)) {
    response.writeHead(403).end();
    return;
  }
  fs.readFile(filename, (error, contents) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500).end();
      return;
    }
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filename)] || "application/octet-stream",
      "Content-Length": Buffer.byteLength(contents),
      "Access-Control-Allow-Origin": "*"
    });
    response.end(contents);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`MediCare Frontend running at http://127.0.0.1:${port}/index.html`);
});
