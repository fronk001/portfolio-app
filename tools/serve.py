"""
Dev server. This machine has no Node, so Python serves the files.

    py tools/serve.py            # project root on :8540 -> http://localhost:8540/src/
    py tools/serve.py src 8540   # just the app

Sends Cache-Control: no-store on everything. Without it the browser keeps
serving stale ES modules after an edit, and a test run can quietly pass
against code that is no longer on disk. (Learned in the Mongolian project.)

/__local/main.json and /__local/series.json are the tracker's own figures, as
its engine last wrote them on this laptop:

    cd "../Portfolio tracker" && .venv\\Scripts\\python.exe -m src.engine --out data\\engine

That is what `?local` shows: your real numbers, before (or without) Firebase.
They are read from the tracker's folder, never copied into this one, which
is published.
"""
import sys
import time
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ENGINE_OUT = Path(__file__).resolve().parent.parent.parent / "Portfolio tracker" / "data" / "engine"

EXTRA_TYPES = {
    ".webmanifest": "application/manifest+json",
    ".woff2": "font/woff2",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".json": "application/json",
}


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, **EXTRA_TYPES}
    offline = False

    def do_GET(self):
        # /__wait answers after 0.2 s. Headless Edge fast-forwards its clock
        # whenever no request is open, so a test page that must wait in real
        # time keeps one of these open meanwhile.
        if self.path.startswith("/__wait"):
            time.sleep(0.2)
            self.send_response(204)
            self.end_headers()
            return
        # /__offline?on and ?off: tools/sw-check.html pretends the published
        # copy (dist/) is out of reach, to see the app open from the phone's copy.
        if self.path.startswith("/__offline"):
            Handler.offline = self.path.endswith("on")
            self.send_response(204)
            self.end_headers()
            return
        if Handler.offline and self.path.startswith("/dist/"):
            self.send_error(503, "Pretend offline (tools/sw-check.html)")
            return
        if self.path.split("?")[0] in ("/__local/main.json", "/__local/series.json"):
            path = ENGINE_OUT / self.path.split("?")[0].rsplit("/", 1)[1]
            if not path.is_file():
                self.send_error(404, "No engine output yet: run the tracker's engine with --out data\\engine")
                return
            body = path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


def main() -> None:
    args = [a for a in sys.argv[1:] if a != "--open"]
    root = args[0] if args else "."
    port = int(args[1]) if len(args) > 1 else 8540
    server = ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=root))
    url = f"http://localhost:{port}/" + ("src/" if root == "." else "")
    print(f"Portfolio: {url}  (close this window to stop)", flush=True)
    if "--open" in sys.argv:
        webbrowser.open(url + "?local")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
