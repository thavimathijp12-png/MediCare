const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const apiOrigin = process.env.MEDICARE_E2E_API_ORIGIN || "http://127.0.0.1:18080";
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml"
};

http.createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
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
    let body = contents;
    if (filename.endsWith("index.html")) {
      body = contents.toString("utf8").replace(
        '<meta name="medicare-api-base-url" content="">',
        `<meta name="medicare-api-base-url" content="${apiOrigin}">`
      );
    }
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filename)] || "application/octet-stream",
      "Content-Length": Buffer.byteLength(body)
    });
    response.end(body);
  });
}).listen(5503, "127.0.0.1");
