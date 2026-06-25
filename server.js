const http = require("http");
const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

const root = __dirname;
const port = Number(process.env.PORT || 5173);
const shouldOpen = process.argv.includes("--open");

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".ico", "image/x-icon"]
]);

function resolveRequest(url) {
  const parsed = new URL(url, `http://127.0.0.1:${port}`);
  const rawPath = parsed.pathname === "/" ? "/index.html" : parsed.pathname;
  const decoded = decodeURIComponent(rawPath);
  const resolved = path.resolve(root, `.${decoded}`);

  if (!resolved.startsWith(root)) {
    return null;
  }

  return resolved;
}

const server = http.createServer((request, response) => {
  const filePath = resolveRequest(request.url);
  if (!filePath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(data);
  });
});

server.listen(port, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${port}/`;
  console.log(`32x32 Minecraft Image Slicer running at ${url}`);
  console.log("Close this command window to stop the local site.");

  if (shouldOpen) {
    const command = process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
    childProcess.exec(command);
  }
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
