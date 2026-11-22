#!/usr/bin/env python3
"""Exercise a real OpenCode server against a deterministic loopback model."""

from base64 import b64encode
from contextlib import contextmanager
import json
import os
from pathlib import Path
import queue
import re
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import ProxyHandler, Request, build_opener


HTTP = build_opener(ProxyHandler({}))
MARKERS = ("BEGIN_PROBE", "QUEUED_PROBE", "STEERED_PROBE", "PASSIVE_PROBE", "BLOCKED_PROBE",
           "MERGED_CONTEXT_PROBE", "PUBLISH_QUEUE", "PUBLISH_STEER")


def markers_in(value):
    text = json.dumps(value)
    return [marker for marker in MARKERS if marker in text]


class Model(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_POST(self):
        data = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        markers = markers_in(data.get("messages"))
        available = [item["function"]["name"] for item in data.get("tools", [])]
        first = "BEGIN_PROBE" in markers and "probe_hold" in available and not any(
            msg.get("role") == "tool" for msg in data["messages"]
        )
        last = data.get("messages", [])[-1]
        publish = None
        if last.get("role") == "user" and "probe_publish" in available:
            publish = re.search(r"(PUBLISH_QUEUE|PUBLISH_STEER) (ses_[\w-]+)",
                                json.dumps(last))
        if publish:
            mode = "queue" if publish[1] == "PUBLISH_QUEUE" else "steer"
            args = {"recipient": publish[2], "mode": mode}
        if markers:
            self.server.requests.append((markers, first))
        if first and not self.server.release.wait(20):
            self.send_error(504)
            return
        if first or publish:
            delta = {"role": "assistant", "tool_calls": [{
                "index": 0, "id": "call_probe", "type": "function",
                "function": {"name": "probe_publish" if publish else "probe_hold",
                             "arguments": json.dumps(args) if publish else "{}"},
            }]}
        else:
            delta = {"role": "assistant", "content": "mock OK"}
        chunks = [
            {"delta": delta, "finish_reason": None},
            {"delta": {}, "finish_reason": "tool_calls" if first or publish else "stop"},
        ]
        events = (
            "data: " + json.dumps({
                "id": "chatcmpl-probe", "object": "chat.completion.chunk",
                "created": int(time.time()), "model": data["model"],
                "choices": [{"index": 0, **chunk}],
            }) + "\n\n"
            for chunk in chunks
        )
        body = ("".join(events) + "data: [DONE]\n\n").encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


PLUGIN = """
import { appendFileSync, existsSync } from "node:fs"
export default {
  id: "delivery-probe",
  async setup(ctx) {
    await ctx.tool.transform(editor => {
      editor.add({
        name: "probe_hold",
        description: "Return a deterministic probe tool result",
        input: {type: "object", properties: {}, additionalProperties: false},
        options: {codemode: false},
        execute: async () => ({content: "tool result"}),
      })
    })
    await ctx.session.hook("context", async event => {
      const contexts = JSON.stringify(event.messages)
      const markers = ["BEGIN_PROBE","QUEUED_PROBE","STEERED_PROBE","PASSIVE_PROBE","BLOCKED_PROBE"]
        .filter(marker => contexts.includes(marker))
      const roomIDs = event.messages.flatMap(message => message.metadata?.roomIDs ?? [])
      appendFileSync(process.env.PROBE_CONTEXT_LOG, JSON.stringify({markers, roomIDs}) + "\\n")
      if (markers.includes("BLOCKED_PROBE")) {
        throw new Error("Probe aborted in the context hook, before model dispatch")
      }
      if (markers.includes("STEERED_PROBE") && !markers.includes("QUEUED_PROBE")) {
        for (let i = 0; i < 300; i++) {
          if (existsSync(process.env.PROBE_CONTEXT_LOG + ".release")) return
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        throw new Error("probe context release timed out")
      }
    })
  },
}
"""


def run(model, root, port, password):
    base = f"http://127.0.0.1:{port}"
    auth = "Basic " + b64encode(f"opencode:{password}".encode()).decode()

    def api(path, payload=None):
        req = Request(
            base + path,
            data=None if payload is None else json.dumps(payload).encode(),
            headers={"Content-Type": "application/json", "Authorization": auth},
        )
        try:
            with HTTP.open(req, timeout=8) as response:
                return json.load(response)
        except HTTPError as error:
            raise RuntimeError(f"{path}: HTTP {error.code} {error.read().decode()}") from error

    def wait_until(test, timeout=10):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if test():
                return
            time.sleep(0.05)
        raise AssertionError(f"Timed out; model observations: {model.requests}")

    def ready():
        try:
            return api("/api/info")
        except (OSError, URLError):
            return False

    wait_until(ready)
    location = {"directory": str(root)}
    sid = api("/api/session", {
        "title": "Delivery probe", "location": location,
        "model": {"providerID": "probe", "id": "fake-model"},
        "permissions": [{"action": "probe_hold", "resource": "*", "effect": "allow"}],
    })["data"]["id"]
    path = f"/api/session/{sid}"
    event_ready = threading.Event()
    event_queue = queue.SimpleQueue()

    def listen():
        try:
            req = Request(base + "/api/event", headers={"Authorization": auth})
            with HTTP.open(req, timeout=15) as response:
                event_ready.set()
                for line in response:
                    if line.startswith(b"data:"):
                        value = json.loads(line[5:])
                        if value.get("data", {}).get("sessionID") == sid:
                            data = value["data"]
                            event_queue.put((value["type"], data.get("inboxID") or data.get("assistantMessageID")))
        except (OSError, ValueError):
            pass

    threading.Thread(target=listen, daemon=True).start()
    assert event_ready.wait(8), "SSE connection was not established"

    def prompt(name, text, delivery, resume=True):
        return api(path + "/prompt", {
            "id": "msg_" + name, "text": text, "delivery": delivery, "resume": resume,
            "metadata": {"roomIDs": ["room_" + name]},
        })["data"]

    def inbox():
        return [entry["id"] for entry in api(path + "/inbox")["data"]]

    passive = prompt("passive", "PASSIVE_PROBE", "queue", resume=False)
    duplicate_pending = prompt("passive", "should not replace the first payload", "steer", resume=False)
    assert duplicate_pending == passive, (passive, duplicate_pending)
    assert inbox() == ["msg_passive"], inbox()
    assert not model.requests, model.requests
    HTTP.open(Request(base + path + "/inbox/msg_passive", method="DELETE",
                      headers={"Authorization": auth}), timeout=8).close()

    prompt("begin", "BEGIN_PROBE", "queue")
    wait_until(lambda: any(hold for _, hold in model.requests))
    queued = prompt("queued", "QUEUED_PROBE", "queue")
    steered = prompt("steered", "STEERED_PROBE", "steer")
    assert inbox() == ["msg_queued", "msg_steered"], inbox()
    assert len(model.requests) == 1, model.requests
    model.release.set()

    events = []

    def drain_events():
        while not event_queue.empty():
            events.append(event_queue.get())

    def received(kind, item_id=None):
        drain_events()
        return any(event == kind and (item_id is None or item_id == item)
                   for event, item in events)

    def contexts():
        log = root / "context.jsonl"
        return [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []

    wait_until(lambda: received("session.inbox.delivered", "msg_steered") and any(
        "STEERED_PROBE" in frame["markers"] for frame in contexts()
    ))
    assert all("STEERED_PROBE" not in markers for markers, _ in model.requests)
    assert "msg_queued" in inbox()
    print("Steered input was delivered and in the context hook while the model had not received it.")
    (root / "context.jsonl.release").touch()

    wait_until(lambda: any("QUEUED_PROBE" in m for m, _ in model.requests))
    observed = [value[0] for value in model.requests]
    assert observed[:3] == [
        ["BEGIN_PROBE"],
        ["BEGIN_PROBE", "STEERED_PROBE"],
        ["BEGIN_PROBE", "QUEUED_PROBE", "STEERED_PROBE"],
    ], observed
    for original in (queued, steered):
        name = original["id"].removeprefix("msg_")
        result = prompt(name, "should not replace delivered payload", "queue")
        assert result["id"] == original["id"] and result["payload"] == original["payload"], (
            original, result
        )
        print(f"Delivered retry ({name}): mode={result['delivery']}, "
              f"same response timestamp={result['time'] == original['time']}")
    assert inbox() == [], inbox()
    wait_until(lambda: received("session.inbox.delivered", "msg_queued"))
    for marker, name in (("QUEUED_PROBE", "queued"), ("STEERED_PROBE", "steered")):
        assert ("session.inbox.enqueued", "msg_" + name) in events, events
        assert any(marker in frame["markers"] and "room_" + name in frame["roomIDs"]
                   for frame in contexts()), marker
    def steps_ended():
        drain_events()
        return sum(event == "session.step.ended" for event, _ in events)

    wait_until(lambda: steps_ended() >= 3)
    assert received("session.step.first-token"), events
    first_tokens = {item for event, item in events if event == "session.step.first-token"}
    assert len(first_tokens) == 3 and None not in first_tokens, events

    prompt("blocked", "BLOCKED_PROBE", "steer")
    wait_until(lambda: received("session.inbox.delivered", "msg_blocked") and
               "Probe aborted in the context hook, before model dispatch"
               in (root / "server.log").read_text())
    assert any("BLOCKED_PROBE" in frame["markers"] for frame in contexts())
    assert all("BLOCKED_PROBE" not in m for m, _ in model.requests), model.requests
    drain_events()
    assert {item for event, item in events if event == "session.step.first-token"} == first_tokens
    for name in ("queued", "steered"):
        for kind in ("enqueued", "delivered"):
            assert events.count((f"session.inbox.{kind}", "msg_" + name)) == 1, events
    assert len(model.requests) == 3, model.requests
    print("Provider requests:", observed)
    print("Inbox events:", [item for item in events if item[0].startswith("session.inbox.")])
    print("Step events:", [event for event, _ in events if event.startswith("session.step.")])
    print("Pending and delivered IDs both deduplicate; original text survives retries.")
    print("Context hook observed both injected messages and their structured room IDs.")
    print("A failed context hook yielded delivery, but no provider request or first token.")


def free_port():
    with socket.socket() as probe_socket:
        probe_socket.bind(("127.0.0.1", 0))
        return probe_socket.getsockname()[1]


@contextmanager
def managed_process(args, root, env, log_name):
    with (root / log_name).open("w+") as log:
        proc = subprocess.Popen(args, cwd=root, env=env, stdout=log, stderr=log)
        try:
            yield
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()


def run_openchamber(model, root, port, password, env):
    chamber = shutil.which("openchamber")
    if not chamber:
        raise SystemExit("openchamber is not installed")
    print("OpenChamber", subprocess.check_output([chamber, "--version"], text=True).strip())
    chamber_port = free_port()
    probe = root / "extension"
    (probe / "plugin").mkdir(parents=True)
    fixtures = Path(__file__).resolve().parent / "fixtures"
    shutil.copyfile(fixtures / "openchamber-plugin.js", probe / "plugin/index.js")
    shutil.copyfile(fixtures / "openchamber-service.mjs", probe / "service.mjs")
    (probe / "panel.html").write_text("<!doctype html><p>Headless smoke fixture</p>")
    (probe / "bridge.json").write_text(json.dumps({
        "endpoint": str(root / "endpoint"), "token": secrets.token_urlsafe(32),
    }))
    (probe / "package.json").write_text(json.dumps({
        "name": "room-smoke-probe", "type": "module", "version": "0.0.1",
        "openchamber": {"apiVersion": 1, "contributes": {
            "panel": {"id": "room-smoke-probe", "name": "Room Smoke Probe", "entry": "panel.html",
                      "icon": "chat-3-line"},
            "service": {"entry": "service.mjs", "runtime": "host", "keepRunning": True},
            "opencodePlugin": "plugin",
        }},
    }))
    opencode_base = f"http://127.0.0.1:{port}"
    chamber_base = f"http://127.0.0.1:{chamber_port}"
    opencode_auth = "Basic " + b64encode(f"opencode:{password}".encode()).decode()

    def request(base, path, data=None, method=None):
        headers = {"Content-Type": "application/json"}
        if base == opencode_base:
            headers["Authorization"] = opencode_auth
        else:
            headers["Origin"] = chamber_base
        req = Request(base + path, data=None if data is None else json.dumps(data).encode(),
                      headers=headers, method=method)
        try:
            with HTTP.open(req, timeout=8) as response:
                body = response.read()
                return json.loads(body) if body else None
        except HTTPError as error:
            raise RuntimeError(f"{path}: HTTP {error.code} {error.read().decode()}") from error

    def wait_until(test, label):
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            if test():
                return
            time.sleep(0.05)
        raise AssertionError(f"{label}; model observations: {model.requests}")

    def ready(base, path):
        try:
            return request(base, path)
        except (OSError, RuntimeError):
            return False

    wait_until(lambda: ready(opencode_base, "/api/info"), "OpenCode not ready")
    chamber_env = {**env, "OPENCODE_HOST": opencode_base, "OPENCODE_SKIP_START": "1",
                   "OPENCHAMBER_DATA_DIR": str(root / "chamber-data")}
    with managed_process([chamber, "serve", "--foreground", "--api-only", "--port",
                          str(chamber_port)], root, chamber_env, "openchamber.log"):
        wait_until(lambda: ready(chamber_base, "/api/guests"), "OpenChamber not ready")
        path = "/api/guests/room-smoke-probe"
        installed = request(chamber_base, "/api/guests", {"path": str(probe)})
        guest = installed["guest"]
        capabilities = guest["capabilities"]["requested"]
        assert "service" in capabilities and "opencodePlugin" in capabilities, guest
        request(chamber_base, path + "/capabilities", {"granted": capabilities}, method="PUT")
        request(chamber_base, path + "/opencode-plugin/global-config", {})
        wait_until(lambda: (root / "endpoint").exists(), "Plugin service did not start headlessly")

        def new_session(name, tool):
            return request(opencode_base, "/api/session", {
                "title": name, "location": {"directory": str(root)},
                "model": {"providerID": "probe", "id": "fake-model"},
                "permissions": [{"action": tool, "resource": "*", "effect": "allow"}],
            })["data"]["id"]

        def send(sid, text):
            return request(opencode_base, f"/api/session/{sid}/prompt", {"text": text})["data"]

        recipient = new_session("Room recipient", "probe_hold")
        author = new_session("Room author", "probe_publish")
        assert author != recipient
        send(recipient, "BEGIN_PROBE")
        wait_until(lambda: any(hold for _, hold in model.requests), "Recipient did not start")

        def inbox():
            return request(opencode_base, f"/api/session/{recipient}/inbox")["data"]

        send(author, f"PUBLISH_QUEUE {recipient}")
        wait_until(lambda: any(item["delivery"] == "queue" for item in inbox()), "Queue did not arrive")
        send(author, f"PUBLISH_STEER {recipient}")
        wait_until(lambda: len(inbox()) == 2, "Steer did not arrive")
        queued, steered = inbox()
        assert queued["delivery"] == "queue" and "QUEUED_PROBE" in queued["payload"]["text"], queued
        assert steered["delivery"] == "steer", steered
        text = steered["payload"]["text"]
        assert text.index("MERGED_CONTEXT_PROBE") < text.index("STEERED_PROBE"), text
        assert len(steered["payload"]["metadata"]["roomIDs"]) == 2, steered
        model.release.set()
        wait_until(lambda: any("QUEUED_PROBE" in m and "BEGIN_PROBE" in m
                               for m, _ in model.requests), "Queued post did not reach model")
        recipient_requests = [m for m, _ in model.requests if "BEGIN_PROBE" in m]
        assert recipient_requests[:3] == [
            ["BEGIN_PROBE"],
            ["BEGIN_PROBE", "STEERED_PROBE", "MERGED_CONTEXT_PROBE"],
            ["BEGIN_PROBE", "QUEUED_PROBE", "STEERED_PROBE", "MERGED_CONTEXT_PROBE"],
        ], recipient_requests
        print("Two independent sessions used the installed OpenChamber extension service and bundled OpenCode plugin.")
        print("No browser or panel opened; one ordinary post queued and two posts combined into one steer.")
        print("Recipient requests:", recipient_requests)


def main():
    integrated = sys.argv[1:] == ["--openchamber"]
    if sys.argv[1:] and not integrated:
        raise SystemExit("Usage: probe-opencode-delivery.py [--openchamber]")
    binary = shutil.which("opencode")
    if not binary:
        raise SystemExit("opencode is not installed")
    print(subprocess.check_output([binary, "--version"], text=True).strip())
    scratch = Path("/tmp/opencode")
    with tempfile.TemporaryDirectory(prefix="opencode-delivery-",
                                     dir=scratch if scratch.is_dir() else None) as temp:
        root = Path(temp)
        with ThreadingHTTPServer(("127.0.0.1", 0), Model) as model:
            model.requests = []
            model.release = threading.Event()
            threading.Thread(target=model.serve_forever, daemon=True).start()
            if not integrated:
                (root / ".opencode/plugins/probe").mkdir(parents=True)
                (root / ".opencode/plugins/probe/index.ts").write_text(PLUGIN)
            (root / "opencode.json").write_text(json.dumps({
                "providers": {"probe": {
                    "name": "Local probe", "env": ["PROBE_API_KEY"],
                    "package": "@opencode/ai/providers/openai-compatible",
                    "settings": {"baseURL": f"http://127.0.0.1:{model.server_port}/v1"},
                    "models": {"fake-model": {"name": "Fake model", "capabilities": {"toolcall": True}}},
                }},
            }))
            env = {"PATH": os.environ["PATH"], "HOME": str(root), "PROBE_API_KEY": "mock",
                   "PROBE_CONTEXT_LOG": str(root / "context.jsonl"), "OPENCODE_DB": ":memory:"}
            password = secrets.token_urlsafe(32)
            env["OPENCODE_PASSWORD"] = password
            for key in ("XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_STATE_HOME", "XDG_CACHE_HOME"):
                env[key] = str(root / key)
            port = free_port()
            with (root / "server.log").open("w+") as log:
                proc = subprocess.Popen(
                    [binary, "serve", "--hostname", "127.0.0.1", "--port", str(port),
                     "--print-logs"],
                    cwd=root, env=env, stdout=log, stderr=log,
                )
                try:
                    if integrated:
                        run_openchamber(model, root, port, password, env)
                    else:
                        run(model, root, port, password)
                except Exception:
                    log.seek(0)
                    text = log.read().replace(password, "[redacted]")
                    text = re.sub(r"server password .+", "server password [redacted]", text)
                    print("\n".join(line for line in text.splitlines()
                                    if re.search(r"warn|error|plugin|/api/(info|session)", line, re.I))[-7000:])
                    if integrated and (root / "openchamber.log").exists():
                        extra = (root / "openchamber.log").read_text().replace(password, "[redacted]")
                        print(re.sub(r"(?i)(server password |token=)\S+", r"\1[redacted]", extra)[-4500:])
                    raise
                finally:
                    model.release.set()
                    proc.terminate()
                    try:
                        proc.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        proc.kill()
                        proc.wait()
                    model.shutdown()


if __name__ == "__main__":
    main()
