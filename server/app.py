from fastapi import FastApi


app = FastApi()

@app.get("/api/health")
def health():
    return {"ok": true}