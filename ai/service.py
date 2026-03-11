import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from chatbot.support import generate_support_reply
from clustering.kmeans import cluster_student
from prediction.dropout import predict_dropout
from sentiment.engine import analyze_sentiment


class RequestHandler(BaseHTTPRequestHandler):
    def _send(self, status_code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(length).decode("utf-8") if length else "{}"
        return json.loads(raw_body or "{}")

    def log_message(self, _format, *_args):
        return

    def do_GET(self):
        if self.path == "/health":
            self._send(200, {"status": "ok", "service": "PFADS+ AI"})
            return
        self._send(404, {"message": "Not found"})

    def do_POST(self):
        try:
            payload = self._read_json()
        except json.JSONDecodeError:
            self._send(400, {"message": "Invalid JSON"})
            return

        if self.path == "/sentiment":
            self._send(200, analyze_sentiment(payload.get("message", "")))
            return

        if self.path == "/predict":
            self._send(200, predict_dropout(payload))
            return

        if self.path == "/cluster":
            self._send(200, cluster_student(payload.get("sectionScores", {})))
            return

        if self.path == "/chat":
            self._send(200, generate_support_reply(payload))
            return

        self._send(404, {"message": "Not found"})


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 5001), RequestHandler)
    print("PFADS+ AI listening on http://127.0.0.1:5001", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
