import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import subprocess
import time
import json
import urllib.request
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import threading

try:
    from devices import REGISTRY
    print("Устройства успешно загружены.", flush=True)
except ImportError as e:
    print(f"ОШИБКА ИМПОРТА: {e}. Запусти скрипт из папки emulators/", flush=True)
    sys.exit(1)

# ==========================================
# ЛОГИЧЕСКИЕ БЛОКИ
# ==========================================
def logic_passthrough(val): return val
def logic_bool_invert(val): return 1 - int(val)
def logic_scale_50(val): return int(float(val) * 0.5)
def logic_to_max(val): return 100 if float(val) > 0 else 0

LOGIC_BLOCKS = {
    "passthrough": {"name": "Передать как есть", "func": logic_passthrough},
    "invert": {"name": "Инвертировать (Вкл/Выкл)", "func": logic_bool_invert},
    "scale_50": {"name": "Уменьшить на 50%", "func": logic_scale_50},
    "to_max": {"name": "Включить на максимум", "func": logic_to_max},
}

def branch_gt_0(val): return float(val) > 0
def branch_eq_1(val): return float(val) == 1
def branch_gt_50(val): return float(val) > 50

BRANCH_BLOCKS = {
    "gt_0": {"name": "Значение > 0", "func": branch_gt_0},
    "eq_1": {"name": "Значение == 1", "func": branch_eq_1},
    "gt_50": {"name": "Значение > 50", "func": branch_gt_50},
}

ALL_DEVICES = {} 
PORT_MAP = {}
DEVICES = []     
RUNNING_PROCS = {} 

def build_devices_db():
    start_port = 8100
    for i, (family, cls) in enumerate(REGISTRY.items()):
        port = start_port + i
        PORT_MAP[family] = port
        dev = cls(serial="0")
        signals = {}
        for s in dev.declaration():
            signals[s["name"]] = {
                "type": "bool" if s["control"] in ("switch", "list") else "number",
                "management": s["management"], 
                "kind": s.get("kind", "property")
            }
        ALL_DEVICES[family] = {
            "id": family, "name": dev.title, "url": f"http://localhost:{port}", "signals": signals
        }

class PipelineGraph:
    def __init__(self, nodes, edges, pipeline_id):
        self.nodes = {n["id"]: n for n in nodes}
        self.edges = edges
        self.pipeline_id = pipeline_id

    def apply(self):
        try:
            source_node = next((n for n in self.nodes.values() if n["type"] == "source"), None)
            if not source_node: return
            in_dev_id = source_node["data"].get("dev")
            source_signal = source_node["data"].get("sig")
            if not in_dev_id or not source_signal: return
            in_dev = next((d for d in DEVICES if d["id"] == in_dev_id), None)
            if not in_dev: return

            with urllib.request.urlopen(f"{in_dev['url']}/state", timeout=1) as resp:
                state = json.loads(resp.read().decode('utf-8'))
            raw = state.get(source_signal)
            if raw is None: return

            self.evaluate(source_node["id"], raw)
        except Exception:
            pass

    def evaluate(self, node_id, value):
        try:
            node = self.nodes.get(node_id)
            if not node: return

            if node["type"] == "target":
                out_dev_id = node["data"].get("dev")
                target_signal = node["data"].get("sig")
                if out_dev_id and target_signal:
                    out_dev = next((d for d in DEVICES if d["id"] == out_dev_id), None)
                    if out_dev:
                        self.send_command(out_dev, target_signal, value)
                return

            if node["type"] == "logic":
                logic_id = node["data"].get("logicId")
                if logic_id in LOGIC_BLOCKS:
                    value = LOGIC_BLOCKS[logic_id]["func"](value)

            elif node["type"] == "branch":
                branch_id = node["data"].get("branchId")
                result = False
                if branch_id in BRANCH_BLOCKS:
                    result = BRANCH_BLOCKS[branch_id]["func"](value)
                
                handle = "true" if result else "false"
                out_edges = [e for e in self.edges if e["source"] == node_id]
                for edge in out_edges:
                    if edge.get("sourceHandle") == handle:
                        self.evaluate(edge["target"], value)
                return

            out_edges = [e for e in self.edges if e["source"] == node_id]
            for edge in out_edges:
                self.evaluate(edge["target"], value)
                
        except Exception:
            pass

    def send_command(self, dev, signal, value):
        try:
            target_type = dev["signals"].get(signal, {}).get("type", "number")
            if target_type == "bool":
                value = 1 if float(value) > 0 else 0
            else:
                value = float(value)
                
            payload = urllib.parse.urlencode({"signal": signal, "value": str(value)}).encode('utf-8')
            req = urllib.request.Request(f"{dev['url']}/command", data=payload, method="POST")
            req.add_header("Content-Type", "application/x-www-form-urlencoded")
            urllib.request.urlopen(req, timeout=1)
            print(f"[Command Sent] {dev['id']} {signal} = {value}", flush=True)
        except Exception:
            pass

    def describe(self):
        source = next((n for n in self.nodes.values() if n["type"] == "source"), None)
        if not source: return []
        
        scenarios = []
        def dfs(node_id, path, visited):
            if node_id in visited: return
            new_visited = visited | {node_id}
            node = self.nodes.get(node_id)
            if not node: return

            label = ""
            if node["type"] == "source": label = f"Если [{node['data'].get('dev')}] ({node['data'].get('sig')})"
            elif node["type"] == "logic": label = f"Логика [{LOGIC_BLOCKS.get(node['data'].get('logicId'), {}).get('name', '?')}]"
            elif node["type"] == "branch": label = f"Условие [{BRANCH_BLOCKS.get(node['data'].get('branchId'), {}).get('name', '?')}]"
            elif node["type"] == "target":
                label = f"То [{node['data'].get('dev')}] ({node['data'].get('sig')})"
                scenarios.append({
                    "id": str(self.pipeline_id), 
                    "text": " ➡ ".join(path + [label])
                })
                return

            out_edges = [e for e in self.edges if e["source"] == node_id]
            for edge in out_edges:
                edge_label = label
                if node["type"] == "branch":
                    edge_label += " (Да)" if edge.get("sourceHandle") == "true" else " (Нет)"
                dfs(edge["target"], path + [edge_label], new_visited)
                
        dfs(source["id"], [], set())
        return scenarios

PIPELINES = [] 

class APIHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _send_json(self, data, status=200):
        self.send_response(status)
        self._send_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        try:
            self.wfile.write(json.dumps(data).encode('utf-8'))
        except Exception:
            pass

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        try:
            if self.path == "/api/devices/available":
                self._send_json(list(ALL_DEVICES.values()))
            elif self.path == "/api/devices":
                self._send_json(DEVICES)
            elif self.path == "/api/logic_blocks":
                blocks = []
                for k, v in LOGIC_BLOCKS.items():
                    blocks.append({"id": k, "name": v["name"], "block_type": "logic"})
                for k, v in BRANCH_BLOCKS.items():
                    blocks.append({"id": k, "name": v["name"], "block_type": "branch"})
                self._send_json(blocks)
            elif self.path == "/api/pipelines":
                res = []
                for p in PIPELINES:
                    try:
                        desc = p.describe()
                        res.extend(desc)
                    except Exception as e:
                        print(f"[Describe Error] {e}", flush=True)
                self._send_json(res)
            elif self.path == "/api/live_state":
                live_data = {}
                for dev in DEVICES:
                    try:
                        with urllib.request.urlopen(f"{dev['url']}/state", timeout=0.5) as resp:
                            live_data[dev['id']] = {"name": dev["name"], "signals": json.loads(resp.read().decode('utf-8'))}
                    except Exception:
                        live_data[dev['id']] = {"name": dev["name"], "signals": {"status": "Не отвечает"}}
                self._send_json(live_data)
            else:
                self._send_json({"error": "Not found"}, 404)
        except Exception as e:
            print(f"[GET ERROR] {e}", flush=True)
            self._send_json({"error": str(e)}, 500)

    def do_POST(self):
        try:
            if self.path == "/api/devices/select":
                content_length = int(self.headers.get('Content-Length', 0))
                data = json.loads(self.rfile.read(content_length).decode('utf-8'))
                selected = data.get("devices") or []
                
                base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                main_script = os.path.join(base_dir, "main.py")

                for fam, proc in list(RUNNING_PROCS.items()):
                    if fam not in selected:
                        proc.terminate()
                        del RUNNING_PROCS[fam]
                
                time.sleep(0.5) 

                for fam in selected:
                    if fam not in RUNNING_PROCS and fam in ALL_DEVICES:
                        port = PORT_MAP[fam]
                        proc = subprocess.Popen([sys.executable, main_script, fam, "--port", str(port), "--interval", "1"])
                        RUNNING_PROCS[fam] = proc

                global DEVICES
                DEVICES = [ALL_DEVICES[fam] for fam in selected if fam in ALL_DEVICES]
                self._send_json({"status": "ok"})
                
            elif self.path == "/api/pipelines":
                content_length = int(self.headers.get('Content-Length', 0))
                data = json.loads(self.rfile.read(content_length).decode('utf-8'))
                nodes = data.get("nodes", [])
                edges = data.get("edges", [])
                
                if any(n["type"] == "source" for n in nodes) and any(n["type"] == "target" for n in nodes):
                    new_id = str(int(time.time() * 1000))
                    PIPELINES.append(PipelineGraph(nodes, edges, new_id))
                    self._send_json({"status": "ok", "id": new_id})
                else:
                    self._send_json({"error": "Нет источника или цели"}, 400)
            else:
                self._send_json({"error": "Not found"}, 404)
        except Exception as e:
            print(f"[POST ERROR] {e}", flush=True)
            self._send_json({"error": str(e)}, 500)

    def do_DELETE(self):
        try:
            if self.path == "/api/pipelines":
                content_length = int(self.headers.get('Content-Length', 0))
                data = json.loads(self.rfile.read(content_length).decode('utf-8'))
                pipe_id = data.get("id")
                
                global PIPELINES
                PIPELINES = [p for p in PIPELINES if str(p.pipeline_id) != str(pipe_id)]
                self._send_json({"status": "ok"})
            else:
                self._send_json({"error": "Not found"}, 404)
        except Exception as e:
            print(f"[DELETE ERROR] {e}", flush=True)
            self._send_json({"error": str(e)}, 500)

    def log_message(self, format, *args):
        pass 

def start_api():
    try:
        server = ThreadingHTTPServer(('0.0.0.0', 9000), APIHandler)
        print("API УСПЕШНО ЗАПУЩЕНО НА ПОРТУ 9000!", flush=True)
        server.serve_forever()
    except OSError:
        print("ОШИБКА: ПОРТ 9000 УЖЕ ЗАНЯТ!", flush=True)

def engine_loop():
    while True:
        for p in PIPELINES:
            p.apply()
        time.sleep(1)

def main():
    print("--- ЗАПУСК БЭКЕНДА ---", flush=True)
    build_devices_db()
    print("Запуск потока API...", flush=True)
    threading.Thread(target=start_api, daemon=True).start()
    threading.Thread(target=engine_loop, daemon=True).start()

    try:
        while True: time.sleep(1)
    except KeyboardInterrupt:
        for p in RUNNING_PROCS.values():
            p.terminate()

if __name__ == "__main__":
    main()