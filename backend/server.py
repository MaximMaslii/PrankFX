"""
Uvicorn entrypoint.

There used to be two divergent FastAPI apps in this repo (`server.py` and
`app/main.py`) — the one in `server.py` was missing the startup migration, so
which of the two you happened to run changed the app's behaviour. There is now
a single app, defined in `app/main.py`, and this module just re-exports it.

Run with either:
    uvicorn server:app --host 0.0.0.0 --port 8000 --reload
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
"""

from app.main import app


__all__ = ["app"]


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
