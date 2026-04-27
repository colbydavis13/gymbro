import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, "dist", "public");
const PORT = parseInt(process.env.PORT ?? "8080", 10);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

const IMMUTABLE = /\/assets\//;

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] ?? "application/octet-stream";
  const isImmutable = IMMUTABLE.test(filePath);
  const cacheControl = isImmutable
    ? "public, max-age=31536000, immutable"
    : "public, max-age=0, must-revalidate";

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
    });
    res.end(content);
  } catch {
    const fallback = path.join(PUBLIC_DIR, "index.html");
    const html = fs.readFileSync(fallback);
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    });
    res.end(html);
  }
}

const server = http.createServer((req, res) => {
  const rawPath = (req.url ?? "/").split("?")[0];

  let filePath = path.normalize(path.join(PUBLIC_DIR, rawPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    filePath = path.join(PUBLIC_DIR, "index.html");
  }

  serveFile(filePath, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Frontend server listening on port ${PORT}`);
});
