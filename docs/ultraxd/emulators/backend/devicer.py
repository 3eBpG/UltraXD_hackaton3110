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

from devices import REGISTRY

def logic_passthrough(val): return val
def logic_bool_invert(val): return 1 - int(val)
def logic_scale_50(val): return int(float(val) * 0.5)
def logic_to_max(val): return 100 if float(val) > 0 else 0
def logic_leak_to_lamp(val): return 1 if float(val) == 1 else 0

LOGIC_BLOCKS = {
    "passthrough": {"name": "Передать как есть", "func": logic_passthrough},
    "invert": {"name": "Инвертировать (Вкл/Выкл)", "func": logic_bool_invert},
    "scale_50": {"name": "Уменьшить на 50%", "func": logic_scale_50},
    "to_max": {"name": "Включить на максимум (если >0)", "func": logic_to_max},
    "leak_to_lamp": {"name": "Если 1, то 1", "func": logic_leak_to_lamp},
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
            "id": family,
            "name": dev.title,
            "url": f"http://localhost:{port}",
            "signals": signals
        }

class HttpPipeline:
    def __init__(self, in_url, out_url, source_signal, target_signal, logic_id, target_type):
        self.in_url = in_url
        self.out_url = out_url
        self.source_signal = source_signal
        self.target_signal = target_signal
        self.logic_id = logic_id
        self.target_type = target_type
        self.last_value = None

    def apply(self):
        try:
            with urllib.request.urlopen(f"{self.in_url}/state", timeout=1) as resp:
                state = json.loads(resp.read().decode('utf-8'))
            raw = state.get(self.source_signal)
            if raw is None: return
            
            func = LOGIC_BLOCKS[self.logic_id]["func"]
            new_value = func(raw)
            if self.target_type == "bool":
                new_value = 1 if float(new_value) > 0 else 0
                
            if new_value != self.last_value:
                payload = urllib.parse.urlencode({"signal": self.target_signal, "value": str(new_value)}).encode('utf-8')
                req = urllib.request.Request(f"{self.out_url}/command", data=payload, method="POST")
                req.add_header("Content-Type", "application/x-www-form-urlencoded")
                urllib.request.urlopen(req, timeout=1)
                self.last_value = new_value
        except Exception:
            pass

PIPELINES = [] 

class APIHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _send_json(self, data):
        self.send_response(200)
        self._send_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/devices/available":
            self._send_json(list(ALL_DEVICES.values()))
        elif self.path == "/api/devices":
            self._send_json(DEVICES)
        elif self.path == "/api/logic_blocks":
            blocks = [{"id": k, "name": v["name"]} for k, v in LOGIC_BLOCKS.items()]
            self._send_json(blocks)
        elif self.path == "/api/pipelines":
            res = [{"source": p.source_signal, "target": p.target_signal, "logic": LOGIC_BLOCKS[p.logic_id]["name"]} for p in PIPELINES]
            self._send_json(res)
        elif self.path == "/api/live_state":
            live_data = {}
            for dev in DEVICES:
                try:
                    with urllib.request.urlopen(f"{dev['url']}/state", timeout=0.5) as resp:
                        live_data[dev['id']] = {
                            "name": dev["name"],
                            "signals": json.loads(resp.read().decode('utf-8'))
                        }
                except Exception:
                    live_data[dev['id']] = {"name": dev["name"], "signals": {"status": "Не отвечает"}}
            self._send_json(live_data)

    def do_POST(self):
        if self.path == "/api/devices/select":
            content_length = int(self.headers['Content-Length'])
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
            content_length = int(self.headers['Content-Length'])
            data = json.loads(self.rfile.read(content_length).decode('utf-8'))
            
            in_dev = next((d for d in DEVICES if d["id"] == data["source_device"]), None)
            out_dev = next((d for d in DEVICES if d["id"] == data["target_device"]), None)
            
            if in_dev and out_dev and data["logic_id"] in LOGIC_BLOCKS:
                target_sig_info = out_dev["signals"].get(data["target_signal"], {})
                target_type = target_sig_info.get("type", "number") 
                
                PIPELINES.append(HttpPipeline(
                    in_url=in_dev["url"], out_url=out_dev["url"],
                    source_signal=data["source_signal"], target_signal=data["target_signal"],
                    logic_id=data["logic_id"], target_type=target_type
                ))
                self._send_json({"status": "ok"})
                return
        self.send_response(400)
        self._send_cors_headers()
        self.end_headers()

    def log_message(self, format, *args):
        pass 

def start_api():
    server = ThreadingHTTPServer(('0.0.0.0', 9000), APIHandler)
    server.serve_forever()

def engine_loop():
    while True:
        for p in PIPELINES:
            p.apply()
        time.sleep(1)

def main():
    build_devices_db()
    print("Запуск API на порту 9000...")
    threading.Thread(target=start_api, daemon=True).start()
    threading.Thread(target=engine_loop, daemon=True).start()

    print("ВСЕ РАБОТАЕТ.")
    try:
        while True: time.sleep(1)
    except KeyboardInterrupt:
        for p in RUNNING_PROCS.values():
            p.terminate()

if __name__ == "__main__":
    main()