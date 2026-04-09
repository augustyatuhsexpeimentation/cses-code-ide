from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import json

app = FastAPI(title="CSES Code IDE API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
PROBLEMS_FILE = DATA_DIR / "problems.json"


@app.get("/")
def root():
    return {"message": "CSES Code IDE backend running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/problems")
def get_problems():
    if not PROBLEMS_FILE.exists():
        return {"problems": [], "count": 0}

    with open(PROBLEMS_FILE, "r", encoding="utf-8") as f:
        problems = json.load(f)

    return {"problems": problems, "count": len(problems)}


@app.get("/problems/{task_id}")
def get_problem(task_id: str):
    if not PROBLEMS_FILE.exists():
        return {"error": "problems.json not found"}

    with open(PROBLEMS_FILE, "r", encoding="utf-8") as f:
        problems = json.load(f)

    for problem in problems:
        if str(problem.get("task_id")) == str(task_id):
            return problem

    return {"error": "Problem not found", "task_id": task_id}
