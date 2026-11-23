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
import unicodedata
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import ProxyHandler, Request, build_opener


HTTP = build_opener(ProxyHandler({}))
MARKERS = ("BEGIN_PROBE", "QUEUED_PROBE", "STEERED_PROBE", "PASSIVE_PROBE", "BLOCKED_PROBE",
           "PUBLISH_QUEUE", "PUBLISH_STEER", "OLDER_ONE", "OLDER_TWO", "URGENT_NOW")


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
            publish = re.search(r"PUBLISH_(QUEUE|STEER|LIMIT|TOO_LONG) (ses_[\w-]+)",
                                json.dumps(last))
        if publish:
            args = {"recipient": publish[2], "mode": publish[1].lower().replace("_", "-")}
        if last.get("role") == "tool" and "ROOM_MESSAGE_TOO_LONG" in json.dumps(last):
            self.server.length_error = json.dumps(last)
        if markers:
            self.server.requests.append((markers, first))
            raw = json.dumps(data.get("messages"))
            ordered = sorted(markers, key=raw.index)
            self.server.provider_trace.append((ordered, time.monotonic()))
        if first and not self.server.release.wait(20):
            self.send_error(504)
            return
        if (getattr(self.server, "hold_old_batch", False)
                and "QUEUED_PROBE" in markers and "STEERED_PROBE" not in markers
                and not self.server.release_batch.wait(20)):
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
        except RuntimeError as error:
            if str(error).startswith("/api/info: HTTP 503 "):
                return False
            raise

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


def run_promotion(model, root, port, password):
    headers = {
        "Content-Type": "application/json",
        "Authorization": "Basic " + b64encode(f"opencode:{password}".encode()).decode(),
    }

    def api(path, payload=None, method=None):
        req = Request(f"http://127.0.0.1:{port}{path}", headers=headers, method=method,
                      data=None if payload is None else json.dumps(payload).encode())
        with HTTP.open(req, timeout=8) as response:
            body = response.read()
            return json.loads(body).get("data") if body else None

    def expect(check, label):
        limit = time.monotonic() + 10
        while time.monotonic() < limit:
            if check():
                return
            time.sleep(0.02)
        raise AssertionError(f"{label}: {model.provider_trace}")

    def ready():
        try:
            api("/api/info")
            return True
        except OSError:
            return False

    expect(ready, "OpenCode failed to start")
    for trial in ("promote-one", "promote-all", "advance-between-updates"):
        expect(lambda: not api("/api/session/active"), "Previous trial is still active")
        model.release.clear()
        index = len(model.provider_trace)
        sid = api("/api/session", {
            "title": trial, "location": {"directory": str(root)},
            "model": {"providerID": "probe", "id": "fake-model"},
            "permissions": [{"action": "probe_hold", "resource": "*", "effect": "allow"}],
        })["id"]
        path = f"/api/session/{sid}"

        def send(name, text, delivery):
            return api(path + "/prompt", {"id": f"msg_{trial}_{name}", "text": text,
                                          "delivery": delivery})

        def promote(item):
            api(path + "/inbox/" + item["id"], {"delivery": "steer"}, method="PATCH")

        send("seed", "BEGIN_PROBE", "queue")
        expect(lambda: len(model.provider_trace) > index, "Initial model call did not arrive")
        one = send("one", "OLDER_ONE", "queue")
        two = send("two", "OLDER_TWO", "queue")
        if trial != "promote-one":
            promote(one)
        if trial == "advance-between-updates":
            model.release.set()
            expect(lambda: len(model.provider_trace) >= index + 3 and
                   not api("/api/session/active"), "Older items did not drain")
            # Pause the publisher across a runtime boundary: the second PATCH
            # now races with an inbox item that has already been delivered.
            try:
                promote(two)
            except HTTPError as error:
                assert error.code == 409, error.code
                print("Promotion of already delivered item: HTTP 409")
            else:
                raise AssertionError("Expected conflict for already delivered item")
        else:
            promote(two)
        send("urgent", "URGENT_NOW", "steer")
        model.release.set()
        expect(lambda: any("URGENT_NOW" in m for m, _ in model.provider_trace[index:])
               and not api("/api/session/active"), "Trial did not finish")
        trace = [m for m, _ in model.provider_trace[index:]]
        print(f"{trial}: {trace}")
        if trial == "promote-one":
            assert trace[1] == ["BEGIN_PROBE", "OLDER_TWO", "URGENT_NOW"], trace
            assert trace[2][-1] == "OLDER_ONE", trace
        elif trial == "promote-all":
            assert trace[1] == ["BEGIN_PROBE", "OLDER_ONE", "OLDER_TWO", "URGENT_NOW"], trace
            assert len(trace) == 2, trace
        else:
            assert trace[1] == ["BEGIN_PROBE", "OLDER_ONE"], trace
            assert "URGENT_NOW" in trace[-1] and len(trace) >= 3, trace


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


def run_opencode_restart(model, root, port, password, binary, env):
    headers = {
        "Content-Type": "application/json",
        "Authorization": "Basic " + b64encode(f"opencode:{password}".encode()).decode(),
    }
    args = [binary, "serve", "--hostname", "127.0.0.1", "--port", str(port)]
    env = {**env, "OPENCODE_DB": str(root / "restart.sqlite")}

    def api(path, payload=None):
        req = Request(f"http://127.0.0.1:{port}{path}", headers=headers,
                      data=None if payload is None else json.dumps(payload).encode())
        with HTTP.open(req, timeout=8) as response:
            return json.load(response).get("data")

    def ready():
        try:
            api("/api/info")
            return True
        except OSError:
            return False

    def expect(condition, label):
        deadline = time.monotonic() + 8
        while time.monotonic() < deadline:
            if condition():
                return
            time.sleep(0.05)
        raise AssertionError(f"{label}; model observations: {model.provider_trace}")

    def prompt(resume, text="PASSIVE_PROBE"):
        return api(path + "/prompt", {"id": "msg_restart", "text": text,
                                      "delivery": "queue", "resume": resume})

    with managed_process(args, root, env, "restart-original.log"):
        expect(ready, "OpenCode did not start")
        sid = api("/api/session", {
            "title": "OpenCode restart", "location": {"directory": str(root)},
            "model": {"providerID": "probe", "id": "fake-model"},
        })["id"]
        path = f"/api/session/{sid}"
        admitted = prompt(False)
        assert api(path + "/inbox") == [admitted]

    with managed_process(args, root, env, "restart-pending.log"):
        expect(ready, "OpenCode did not restart")
        assert api(path + "/inbox") == [admitted]
        assert prompt(True, "same ID must preserve the original body") == admitted
        expect(lambda: any("PASSIVE_PROBE" in m for m, _ in model.provider_trace),
               "Pending ID did not resume after restart")
        expect(lambda: sid not in api("/api/session/active"), "Resumed execution did not finish")
        assert not api(path + "/inbox")

    with managed_process(args, root, env, "restart-delivered.log"):
        expect(ready, "OpenCode did not restart after delivery")
        assert api(path + "/message/msg_restart")["id"] == "msg_restart"
        assert prompt(True, "do not re-enqueue delivered ID")["payload"] == admitted["payload"]
        assert not api(path + "/inbox") and sid not in api("/api/session/active")
        assert [m for m, _ in model.provider_trace] == [["PASSIVE_PROBE"]]
        print("OpenCode disk restart: same pending ID resumed once; resubmitting the delivered "
              "ID after another restart did not re-enqueue it or run the model again.")


def run_openchamber(model, root, port, password, env, scenario):
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
    shutil.copyfile(fixtures / "display-width.mjs", probe / "display-width.mjs")
    (probe / "panel.html").write_text("<!doctype html><p>Headless smoke fixture</p>")
    bridge_token = secrets.token_urlsafe(32)
    opencode_base = f"http://127.0.0.1:{port}"
    opencode_auth = "Basic " + b64encode(f"opencode:{password}".encode()).decode()
    idle_only = scenario in ("--openchamber-idle", "--openchamber-event")
    race = scenario == "--openchamber-race"
    restart = scenario == "--openchamber-restart"
    model.hold_old_batch = race
    wide_ranges = []
    for cp in range(0x110000):
        char = chr(cp)
        if (unicodedata.category(char) != "Cn" and
                unicodedata.east_asian_width(char) in {"W", "F"}):
            if wide_ranges and cp == wide_ranges[-1][1] + 1:
                wide_ranges[-1][1] = cp
            else:
                wide_ranges.append([cp, cp])
    (probe / "bridge.json").write_text(json.dumps({
        "endpoint": str(root / "endpoint"), "token": bridge_token, "journal": str(root / "journal.json"),
        "opencode": opencode_base, "opencodeAuth": opencode_auth,
        "eventOnly": scenario == "--openchamber-event", "forceQueueRace": race,
        "loseFirstAck": restart,
        "wideRanges": wide_ranges,
    }))
    (probe / "package.json").write_text(json.dumps({
        "name": "room-smoke-probe", "type": "module", "version": "0.0.1",
        "openchamber": {"apiVersion": 1, "contributes": {
            "panel": {"id": "room-smoke-probe", "name": "Room Smoke Probe", "entry": "panel.html",
                      "icon": "chat-3-line"},
            "service": {"entry": "service.mjs", "runtime": "host", "keepRunning": True,
                        "provides": ["opencode"]},
            "opencodePlugin": "plugin",
        }},
    }))
    chamber_base = f"http://127.0.0.1:{chamber_port}"

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
        assert {"service", "opencodePlugin", "opencode"} <= set(capabilities), guest
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
        idle_events = queue.SimpleQueue()
        observed_events = []
        if idle_only:
            subscribed = threading.Event()

            def observe_idle():
                req = Request(opencode_base + "/api/event", headers={"Authorization": opencode_auth})
                try:
                    with HTTP.open(req, timeout=15) as response:
                        subscribed.set()
                        for line in response:
                            if not line.startswith(b"data:"):
                                continue
                            event = json.loads(line[5:])
                            if event.get("data", {}).get("sessionID") == recipient:
                                observed_events.append(event["type"])
                            if (event.get("type") == "session.idle" and
                                    event.get("data", {}).get("sessionID") == recipient):
                                idle_events.put((time.monotonic(), event["created"]))
                except (OSError, ValueError):
                    pass

            threading.Thread(target=observe_idle, daemon=True).start()
            assert subscribed.wait(8), "Idle event subscription was not established"
        send(recipient, "BEGIN_PROBE")
        wait_until(lambda: any(hold for _, hold in model.requests), "Recipient did not start")

        def inbox():
            return request(opencode_base, f"/api/session/{recipient}/inbox")["data"]

        def bridge(route, method="GET"):
            endpoint = (root / "endpoint").read_text()
            req = Request(endpoint + route, method=method,
                          headers={"Authorization": f"Bearer {bridge_token}"})
            with HTTP.open(req, timeout=8) as response:
                body = response.read()
                return json.loads(body) if body else None

        def pending():
            return bridge("/state")["pending"]

        def restarted_from(pid):
            try:
                return bridge("/state")["pid"] != pid
            except (OSError, ValueError):
                return False

        if scenario == "--openchamber-length":
            send(author, f"PUBLISH_TOO_LONG {recipient}")
            wait_until(lambda: model.length_error is not None, "Author did not receive a tool error")
            assert "display width 101; max 100" in model.length_error
            assert pending() == 0 and inbox() == [] and not (root / "journal.json").exists()
            send(author, f"PUBLISH_LIMIT {recipient}")
            wait_until(lambda: pending() == 1, "Post exactly at the limit was rejected")
            [post] = json.loads((root / "journal.json").read_text())["pending"]
            assert post["seq"] == 1 and post["text"] == "界" * 48 + "ab🙂"
            model.release.set()
            wait_until(lambda: ready(opencode_base, f"/api/session/{recipient}/message/msg_room_1"),
                       "Post at limit was not delivered")
            print("Width guard: display width 101 returned a tool error without writing a post; "
                  "width 100 was accepted and delivered intact.")
            return
        send(author, f"PUBLISH_QUEUE {recipient}")
        if race:
            wait_until(lambda: len(inbox()) == 1, "Race fixture did not stage the ordinary batch")
            [older] = inbox()
            assert older["id"] == "msg_room_1" and older["delivery"] == "queue", older
            send(author, f"PUBLISH_STEER {recipient}")
            wait_until(lambda: len(inbox()) == 1 and inbox()[0]["delivery"] == "steer",
                       "Pending older batch was not promoted")
            assert inbox()[0]["id"] == older["id"] and pending() == 1
            model.release.set()
            wait_until(lambda: any("QUEUED_PROBE" in m for m, _ in model.provider_trace),
                       "Promoted batch did not reach the model")
            wait_until(lambda: any(item["id"] == "msg_room_2" and item["delivery"] == "steer"
                                   for item in inbox()), "Urgent batch waited for old model call")
            assert not model.release_batch.is_set()
            model.release_batch.set()
            wait_until(lambda: any("STEERED_PROBE" in m for m, _ in model.provider_trace),
                       "Urgent batch never reached the model")
            trace = [m for m, _ in model.provider_trace if "BEGIN_PROBE" in m]
            assert trace == [["BEGIN_PROBE"], ["BEGIN_PROBE", "QUEUED_PROBE"],
                             ["BEGIN_PROBE", "QUEUED_PROBE", "STEERED_PROBE"]], trace
            print("Race recovery: old queue promoted with its original ID; newer steer accepted "
                  "while the old model request was still blocked:", trace)
            return
        wait_until(lambda: pending() == 1, "Ordinary post did not enter the room backlog")
        wait_until(lambda: sum("PUBLISH_QUEUE" in m for m, _ in model.requests) >= 2,
                   "Author did not finish its ordinary post")
        assert inbox() == [], inbox()
        assert pending() == 1
        if restart:
            before = bridge("/state")["pid"]
            bridge("/restart-probe", "POST")
            wait_until(lambda: restarted_from(before), "OpenChamber did not restart the extension")
            assert pending() == 1 and inbox() == []
            after = bridge("/state")["pid"]
            model.release.set()
            wait_until(lambda: any("QUEUED_PROBE" in m for m, _ in model.provider_trace),
                       "Persisted backlog was not delivered")
            wait_until(lambda: restarted_from(after), "Lost acknowledgment did not restart service")
            wait_until(lambda: not json.loads((root / "journal.json").read_text())["outstanding"],
                       "Restart did not reconcile the outstanding batch")
            delivered = request(opencode_base, f"/api/session/{recipient}/message/msg_room_1")
            assert delivered["data"]["id"] == "msg_room_1" and pending() == 0, delivered
            assert sum("QUEUED_PROBE" in m for m, _ in model.provider_trace) == 1
            print("Service restarted twice: restored the buffered post and reconciled the lost "
                  "acknowledgment using its original message ID without another model request.")
            return
        if idle_only:
            released = time.monotonic()
            model.release.set()
            wait_until(lambda: any("QUEUED_PROBE" in m for m, _ in model.provider_trace),
                       "Ordinary backlog did not automatically flush when the recipient went idle")
            marker_index = next(i for i, (markers, _) in enumerate(model.provider_trace)
                                if "QUEUED_PROBE" in markers)
            markers, arrived = model.provider_trace[marker_index]
            recipient_trace = [m for m, _ in model.provider_trace if "BEGIN_PROBE" in m]
            assert markers == ["BEGIN_PROBE", "QUEUED_PROBE"], markers
            assert recipient_trace == [["BEGIN_PROBE"], ["BEGIN_PROBE"],
                                       ["BEGIN_PROBE", "QUEUED_PROBE"]], recipient_trace
            if scenario == "--openchamber-event":
                assert bridge("/state")["trigger"] == f"execution-event:{recipient}", bridge("/state")
                print("An execution terminal event triggered delivery; the periodic scan was disabled.")
            try:
                idle_arrived, _ = idle_events.get(timeout=0.5)
                print(f"Observed session.idle {(idle_arrived-released)*1000:.0f} ms after model release.")
            except queue.Empty:
                print(f"No session.idle observed; recipient events: {list(dict.fromkeys(observed_events))}")
            print(f"Backlog flushed automatically: {(arrived-released)*1000:.0f} ms "
                  f"from releasing blocked model response (includes tool and model continuation).")
            print("Recipient requests:", recipient_trace)
            return
        send(author, f"PUBLISH_STEER {recipient}")
        wait_until(lambda: len(inbox()) == 1, "Steer did not arrive")
        [steered] = inbox()
        assert steered["delivery"] == "steer", steered
        text = steered["payload"]["text"]
        assert text.index("QUEUED_PROBE") < text.index("STEERED_PROBE"), text
        assert steered["payload"]["metadata"]["roomIDs"] == ["room_1", "room_2"], steered
        model.release.set()
        wait_until(lambda: any("QUEUED_PROBE" in m and "STEERED_PROBE" in m
                               for m, _ in model.requests), "Combined posts did not reach model")
        recipient_requests = [m for m, _ in model.requests if "BEGIN_PROBE" in m]
        assert recipient_requests[:2] == [
            ["BEGIN_PROBE"],
            ["BEGIN_PROBE", "QUEUED_PROBE", "STEERED_PROBE"],
        ], recipient_requests
        print("Two independent sessions used the installed OpenChamber extension service and bundled OpenCode plugin.")
        print("No browser, panel, or debounce timer; a busy recipient received its earlier post and mention in order.")
        print("Recipient requests:", recipient_requests)


def main():
    mode = sys.argv[1:]
    scenarios = {"--openchamber", "--openchamber-idle", "--openchamber-event",
                 "--openchamber-race", "--openchamber-restart", "--openchamber-length"}
    integrated = len(mode) == 1 and mode[0] in scenarios
    if mode and not integrated and mode not in (["--promotion"], ["--opencode-restart"]):
        raise SystemExit(f"Usage: probe-opencode-delivery.py [{'|'.join(sorted(scenarios))}"
                         "|--promotion|--opencode-restart]")
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
            model.provider_trace = []
            model.length_error = None
            model.release = threading.Event()
            model.release_batch = threading.Event()
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
            if mode == ["--opencode-restart"]:
                try:
                    run_opencode_restart(model, root, port, password, binary, env)
                finally:
                    model.shutdown()
                return
            with (root / "server.log").open("w+") as log:
                proc = subprocess.Popen(
                    [binary, "serve", "--hostname", "127.0.0.1", "--port", str(port),
                     "--print-logs"],
                    cwd=root, env=env, stdout=log, stderr=log,
                )
                try:
                    if integrated:
                        run_openchamber(model, root, port, password, env, mode[0])
                    elif mode == ["--promotion"]:
                        run_promotion(model, root, port, password)
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
                    model.release_batch.set()
                    proc.terminate()
                    try:
                        proc.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        proc.kill()
                        proc.wait()
                    model.shutdown()


if __name__ == "__main__":
    main()
