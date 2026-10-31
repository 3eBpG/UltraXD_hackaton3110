from fastapi import FastAPI


fakeDevicesList = {
    1: "dev1",
    2: "dev2",
    3: "dev3",
    5: "dev5",
}

app = FastAPI()

@app.get("/api/health")
def health():
    return {"ok": True}

@app.get("/api/devices/{id}")
def read_devices(id: int):
    if id not in fakeDevicesList:
        raise HTTPException(status_code=404, detail="Устройство не найдено")
    
    return fakeDevicesList[id]