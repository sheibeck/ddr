"use strict";
// A tiny static server for www/ (ES modules need http://). Loopback only, and it
// serves nothing outside www/: any path that resolves elsewhere is a 404.
//
//   node serve.js            serve www/ on 127.0.0.1:8765 until stopped
//   require("./serve").start(port)   resolves to the listening server (capture.js uses this)
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..", "www");
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
};

// The file a request path maps to, or null when it would leave the root.
function resolveInside(urlPath) {
  let p;
  try {
    p = decodeURIComponent(String(urlPath).split("?")[0].split("#")[0]);
  } catch (e) {
    return null;
  }
  if (p.indexOf("\0") !== -1) return null;
  if (p === "/") p = "/index.html";
  const file = path.normalize(path.join(ROOT, p));
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return null;
  return file;
}

function handler(req, res) {
  const file = resolveInside(req.url || "/");
  if (!file) {
    res.writeHead(404);
    return res.end("nf");
  }
  fs.readFile(file, (e, d) => {
    if (e) {
      res.writeHead(404);
      return res.end("nf");
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(d);
  });
}

function start(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve(server);
    });
  });
}

if (require.main === module) {
  const { PORT } = require("./config.js");
  start(PORT).then(
    () => console.log("serving www/ on 127.0.0.1:" + PORT),
    (e) => {
      console.error("cannot serve on " + PORT + ": " + e.message);
      process.exit(2);
    }
  );
}

module.exports = { start, resolveInside, ROOT };
