
from typing import Any

class DeviceAdapter:

    def __init__(self, device, name: str):
        self.device = device
        self.name = name
    def g_inp_dev_sigs(self, input_dev)
    def get(self, signal_name: str) -> Any:
        a=self.device.signals[signal_name].value
        print(a)
        return a

    def set(self, signal_name: str, value: Any) -> None:
        self.device.set_value(signal_name,value)

    def writable(self, signal_name: str) -> bool:
        b=self.device.signals[signal_name].management
        print("доступ",b)
        if b =="w" or b=="rw":
            return True
        else:
            return False
