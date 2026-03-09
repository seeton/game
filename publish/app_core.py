import json
import mimetypes
import os
import posixpath
import random
import sys
import time
import uuid
from http import HTTPStatus
from urllib.parse import parse_qs
from wsgiref.handlers import CGIHandler
from wsgiref.simple_server import make_server

from binary_sim import (
    BinarySimulation,
    DEFAULT_DURATION as BINARY_DEFAULT_DURATION,
    DEFAULT_SYMBOL as BINARY_DEFAULT_SYMBOL,
    build_public_state as build_binary_public_state,
)
from minesweeper import Game


ROOT = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(ROOT, "static")
RUNTIME_DIR = os.path.join(ROOT, "runtime")
MINESWEEPER_SESSION_DIR = os.path.join(RUNTIME_DIR, "sessions")
BINARY_SESSION_DIR = os.path.join(RUNTIME_DIR, "binary_sessions")
SESSION_COOKIE = "signal_sweep_session"
DEFAULT_PORT = 8000
DEFAULT_DIFFICULTY = "medium"
MAX_BODY_BYTES = 16_384
ROOT_STATIC_EXTENSIONS = {".css", ".js", ".svg", ".png", ".ico", ".json", ".webmanifest"}
SESSION_MAX_AGE_SECONDS = 60 * 60 * 24

DIFFICULTIES = {
    "easy": {"rows": 9, "cols": 9, "mines": 10},
    "medium": {"rows": 16, "cols": 16, "mines": 40},
    "hard": {"rows": 16, "cols": 30, "mines": 99},
}

MINES_ACTIONS = {"state", "new", "reveal", "flag"}
BINARY_ACTIONS = {"binary_state", "binary_trade", "binary_reset"}


def ensure_runtime_dirs():
    for directory in (RUNTIME_DIR, MINESWEEPER_SESSION_DIR, BINARY_SESSION_DIR):
        if not os.path.isdir(directory):
            os.makedirs(directory)


def guess_content_type(path):
    content_type, _ = mimetypes.guess_type(path)
    return content_type or "application/octet-stream"


def json_bytes(payload):
    return json.dumps(payload).encode("utf-8")


def status_line(status_code):
    return "%d %s" % (status_code, HTTPStatus(status_code).phrase)


def make_response(start_response, status_code, body, content_type, extra_headers=None):
    headers = [
        ("Content-Type", content_type),
        ("Content-Length", str(len(body))),
    ]
    if extra_headers:
        headers.extend(extra_headers)
    start_response(status_line(status_code), headers)
    return [body]


def json_response(start_response, payload, status_code=HTTPStatus.OK, extra_headers=None):
    return make_response(
        start_response,
        int(status_code),
        json_bytes(payload),
        "application/json; charset=utf-8",
        extra_headers=extra_headers,
    )


def error_response(start_response, status_code, message, extra_headers=None):
    return json_response(
        start_response,
        {"error": message},
        status_code=status_code,
        extra_headers=extra_headers,
    )


def serve_static_file(start_response, relative_path):
    normalized = posixpath.normpath(relative_path).lstrip("/")
    full_path = os.path.abspath(os.path.join(STATIC_DIR, normalized))
    static_root = os.path.abspath(STATIC_DIR)
    if not full_path.startswith(static_root + os.sep) and full_path != static_root:
        return error_response(start_response, HTTPStatus.NOT_FOUND, "asset not found")
    if not os.path.isfile(full_path):
        return error_response(start_response, HTTPStatus.NOT_FOUND, "asset not found")
    with open(full_path, "rb") as handle:
        body = handle.read()
    return make_response(
        start_response,
        HTTPStatus.OK,
        body,
        guess_content_type(full_path),
    )


def parse_request_json(environ):
    try:
        content_length = int(environ.get("CONTENT_LENGTH", "0") or "0")
    except ValueError:
        raise ValueError("invalid Content-Length")
    if content_length > MAX_BODY_BYTES:
        raise ValueError("request body too large")
    if content_length == 0:
        return {}
    raw_body = environ["wsgi.input"].read(content_length)
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except ValueError:
        raise ValueError("invalid JSON body")
    if not isinstance(payload, dict):
        raise ValueError("JSON body must be an object")
    return payload


def parse_cookies(environ):
    header = environ.get("HTTP_COOKIE", "")
    cookies = {}
    for chunk in header.split(";"):
        if "=" not in chunk:
            continue
        key, value = chunk.split("=", 1)
        cookies[key.strip()] = value.strip()
    return cookies


def _session_path(directory, session_id):
    return os.path.join(directory, "%s.json" % session_id)


def _save_json(directory, session_id, payload):
    ensure_runtime_dirs()
    path = _session_path(directory, session_id)
    temp_path = path + ".tmp"
    with open(temp_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, separators=(",", ":"))
    os.replace(temp_path, path)


def _load_json(directory, session_id):
    path = _session_path(directory, session_id)
    if not os.path.isfile(path):
        return None
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def save_minesweeper_session(session_id, game):
    _save_json(MINESWEEPER_SESSION_DIR, session_id, game.serialize())


def load_minesweeper_session(session_id):
    payload = _load_json(MINESWEEPER_SESSION_DIR, session_id)
    if payload is None:
        return None
    return Game.from_dict(payload)


def save_binary_session(session_id, simulation):
    _save_json(BINARY_SESSION_DIR, session_id, simulation.serialize())


def load_binary_session(session_id):
    payload = _load_json(BINARY_SESSION_DIR, session_id)
    if payload is None:
        return None
    return BinarySimulation.from_dict(payload)


def cleanup_old_sessions():
    if random.random() > 0.05:
        return

    ensure_runtime_dirs()
    now_epoch = int(time.time())
    for directory in (MINESWEEPER_SESSION_DIR, BINARY_SESSION_DIR):
        for filename in os.listdir(directory):
            if not filename.endswith(".json"):
                continue
            path = os.path.join(directory, filename)
            try:
                if now_epoch - int(os.path.getmtime(path)) > SESSION_MAX_AGE_SECONDS:
                    os.remove(path)
            except OSError:
                continue


def is_https_request(environ):
    if str(environ.get("wsgi.url_scheme", "")).lower() == "https":
        return True
    if str(environ.get("HTTPS", "")).lower() in ("on", "1"):
        return True
    if str(environ.get("HTTP_X_FORWARDED_PROTO", "")).lower() == "https":
        return True
    if str(environ.get("REQUEST_SCHEME", "")).lower() == "https":
        return True
    return False


def make_cookie_header(session_id, environ):
    parts = [
        "%s=%s" % (SESSION_COOKIE, session_id),
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
    ]
    if is_https_request(environ):
        parts.append("Secure")
    return "; ".join(parts)


def ensure_session_id(environ):
    cleanup_old_sessions()
    cookies = parse_cookies(environ)
    session_id = cookies.get(SESSION_COOKIE)
    if session_id:
        return session_id, []
    session_id = uuid.uuid4().hex
    return session_id, [("Set-Cookie", make_cookie_header(session_id, environ))]


def ensure_minesweeper_session(environ):
    session_id, extra_headers = ensure_session_id(environ)
    game = load_minesweeper_session(session_id)
    if game is None:
        config = DIFFICULTIES[DEFAULT_DIFFICULTY]
        game = Game(config["rows"], config["cols"], config["mines"], DEFAULT_DIFFICULTY)
        save_minesweeper_session(session_id, game)
    return session_id, game, extra_headers


def ensure_binary_simulation(environ):
    session_id, extra_headers = ensure_session_id(environ)
    simulation = load_binary_session(session_id)
    if simulation is None:
        simulation = BinarySimulation()
        save_binary_session(session_id, simulation)
    return session_id, simulation, extra_headers


def handle_minesweeper_api(action, environ, start_response):
    session_id, game, extra_headers = ensure_minesweeper_session(environ)
    method = environ.get("REQUEST_METHOD", "GET").upper()

    if action == "state":
        save_minesweeper_session(session_id, game)
        return json_response(start_response, game.to_public_state(), extra_headers=extra_headers)

    if method != "POST":
        return error_response(
            start_response,
            HTTPStatus.METHOD_NOT_ALLOWED,
            "POST required",
            extra_headers=extra_headers,
        )

    try:
        payload = parse_request_json(environ)
    except ValueError as exc:
        return error_response(start_response, HTTPStatus.BAD_REQUEST, str(exc), extra_headers=extra_headers)

    try:
        if action == "new":
            difficulty_name = str(payload.get("difficulty", DEFAULT_DIFFICULTY))
            config = DIFFICULTIES.get(difficulty_name)
            if config is None:
                return error_response(
                    start_response,
                    HTTPStatus.BAD_REQUEST,
                    "unknown difficulty",
                    extra_headers=extra_headers,
                )
            game = Game(config["rows"], config["cols"], config["mines"], difficulty_name)
        else:
            row = int(payload["row"])
            col = int(payload["col"])
            if action == "reveal":
                game.reveal(row, col)
            else:
                game.toggle_flag(row, col)
    except (KeyError, TypeError, ValueError) as exc:
        return error_response(start_response, HTTPStatus.BAD_REQUEST, str(exc), extra_headers=extra_headers)

    save_minesweeper_session(session_id, game)
    return json_response(start_response, game.to_public_state(), extra_headers=extra_headers)


def handle_binary_api(action, environ, start_response, query):
    session_id, simulation, extra_headers = ensure_binary_simulation(environ)
    method = environ.get("REQUEST_METHOD", "GET").upper()
    selected_symbol = query.get("symbol", [BINARY_DEFAULT_SYMBOL])[0]

    if action == "binary_state":
        state = build_binary_public_state(simulation, selected_symbol, RUNTIME_DIR)
        save_binary_session(session_id, simulation)
        return json_response(start_response, state, extra_headers=extra_headers)

    if method != "POST":
        return error_response(
            start_response,
            HTTPStatus.METHOD_NOT_ALLOWED,
            "POST required",
            extra_headers=extra_headers,
        )

    try:
        payload = parse_request_json(environ)
    except ValueError as exc:
        return error_response(start_response, HTTPStatus.BAD_REQUEST, str(exc), extra_headers=extra_headers)

    selected_symbol = str(payload.get("symbol") or selected_symbol or BINARY_DEFAULT_SYMBOL)

    if action == "binary_reset":
        simulation = BinarySimulation()
        state = build_binary_public_state(simulation, selected_symbol, RUNTIME_DIR)
        save_binary_session(session_id, simulation)
        return json_response(start_response, state, extra_headers=extra_headers)

    state = build_binary_public_state(simulation, selected_symbol, RUNTIME_DIR)
    try:
        simulation.place_trade(
            selected_symbol,
            str(payload["direction"]),
            int(payload["stake"]),
            int(payload.get("duration", BINARY_DEFAULT_DURATION)),
            state["quote"] or {},
        )
    except (KeyError, TypeError, ValueError) as exc:
        return error_response(start_response, HTTPStatus.BAD_REQUEST, str(exc), extra_headers=extra_headers)

    state = build_binary_public_state(simulation, selected_symbol, RUNTIME_DIR)
    save_binary_session(session_id, simulation)
    return json_response(start_response, state, extra_headers=extra_headers)


def handle_api(environ, start_response):
    query = parse_qs(environ.get("QUERY_STRING", ""), keep_blank_values=True)
    action = query.get("action", [""])[0]

    if action in MINES_ACTIONS:
        return handle_minesweeper_api(action, environ, start_response)
    if action in BINARY_ACTIONS:
        return handle_binary_api(action, environ, start_response, query)
    return error_response(start_response, HTTPStatus.NOT_FOUND, "not found")


def application(environ, start_response):
    ensure_runtime_dirs()
    path = environ.get("PATH_INFO", "") or environ.get("SCRIPT_NAME", "") or "/"
    query = parse_qs(environ.get("QUERY_STRING", ""), keep_blank_values=True)

    if path.startswith("/app.xcg") and query.get("action"):
        return handle_api(environ, start_response)

    if path in ("", "/", "/index.html", "/app.xcg", "/app.py"):
        return serve_static_file(start_response, "index.html")

    root_asset = path.lstrip("/")
    if "/" not in root_asset:
        _, extension = os.path.splitext(root_asset)
        if extension.lower() in ROOT_STATIC_EXTENSIONS:
            return serve_static_file(start_response, root_asset)

    if path.startswith("/static/"):
        return serve_static_file(start_response, path[len("/static/"):])

    if path.startswith("/app.xcg") or path.startswith("/api/"):
        return handle_api(environ, start_response)

    return error_response(start_response, HTTPStatus.NOT_FOUND, "not found")


def main():
    ensure_runtime_dirs()
    port = int(os.environ.get("PORT", DEFAULT_PORT))
    server = make_server("127.0.0.1", port, application)
    print("Signal Sweep running on http://127.0.0.1:%d" % port)
    server.serve_forever()


def run_cgi():
    ensure_runtime_dirs()
    sys.stdout.flush()
    CGIHandler().run(application)
