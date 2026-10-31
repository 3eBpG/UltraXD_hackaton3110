import subprocess
import time
import sys
import os
import json
import urllib.request
import urllib.parse

# --- Логика (Твой Transform) ---
def leak_to_lamp(leak_value):
    return 1 if leak_value == 1 else 0

# --- Класс Pipeline, но работающий по HTTP ---
class HttpPipeline:
    def __init__(self, in_url, out_url, source_signal, target_signal, transform):
        self.in_url = in_url
        self.out_url = out_url
        self.source_signal = source_signal
        self.target_signal = target_signal
        self.transform = transform

    def apply(self):
        try:
            # 1. Читаем состояние
            with urllib.request.urlopen(f"{self.in_url}/state", timeout=2) as resp:
                state = json.loads(resp.read().decode('utf-8'))
            
            raw = state.get(self.source_signal)
            if raw is None:
                return
            
            # 2. Логика
            new_value = self.transform(raw)
            
            # 3. Отправляем команду
            payload = urllib.parse.urlencode({
                "signal": self.target_signal,
                "value": str(new_value)
            }).encode('utf-8')
            
            req = urllib.request.Request(f"{self.out_url}/command", data=payload, method="POST")
            req.add_header("Content-Type", "application/x-www-form-urlencoded")
            with urllib.request.urlopen(req, timeout=2) as resp:
                pass  # Успешно отправили
                
        except Exception as e:
            # Если процесс не запущен или не отвечает - молчим и ждем
            pass

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    main_script = os.path.join(base_dir, "main.py")

    print("Запуск датчика протечки (порт 8098)...")
    leak_proc = subprocess.Popen([
        sys.executable, main_script, "leak",
        "--port", "8098", "--interval", "1"
    ])

    print("Запуск светильника (порт 8099)...")
    light_proc = subprocess.Popen([
        sys.executable, main_script, "light",
        "--port", "8099", "--interval", "1"
    ])

    print("Ждем, пока серверы поднимутся...")
    time.sleep(2) # Даем main.py время запустить веб-серверы

    # Настраиваем наш HTTP-пайплайн
    pipeline = HttpPipeline(
        in_url="http://localhost:8098",
        out_url="http://localhost:8099",
        source_signal="leak",
        target_signal="lamp",
        transform=leak_to_lamp
    )

    print("\n--- ВСЕ РАБОТАЕТ ---")
    print("Датчик: http://localhost:8098")
    print("Свет:   http://localhost:8099")
    print("P.S. Чтобы намочить датчик, нажми 'self_test' или измени leak вручную.")
    print("Нажми Ctrl+C для остановки.\n")

    try:
        while True:
            pipeline.apply()
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nОстанавливаем процессы...")
        leak_proc.terminate()
        light_proc.terminate()
        leak_proc.wait()
        light_proc.wait()
        print("Готово.")

if __name__ == "__main__":
    main()