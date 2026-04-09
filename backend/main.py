from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pathlib import Path
from typing import Any, Dict, List, Literal
import json
import subprocess
import tempfile

app = FastAPI(title="CSES Code IDE API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
PROBLEMS_FILE = BASE_DIR / "data" / "problems.json"
TEMP_DIR = BASE_DIR / "temp"
TEMP_DIR.mkdir(exist_ok=True)


class CustomTestCase(BaseModel):
    input: str = ""
    expected_output: str = ""


class RunCodeRequest(BaseModel):
    language: Literal["python", "cpp"]
    code: str = Field(min_length=1)
    task_id: str
    use_examples: bool = True
    custom_test_cases: List[CustomTestCase] = Field(default_factory=list)


def safe_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def safe_list(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def safe_examples(value: Any) -> List[Dict[str, str]]:
    if not isinstance(value, list):
        return []
    cleaned = []
    for item in value:
        if not isinstance(item, dict):
            continue
        cleaned.append(
            {
                "input": safe_str(item.get("input")),
                "output": safe_str(item.get("output")),
            }
        )
    return cleaned


def normalize_problem(problem: Any) -> Dict[str, Any]:
    if not isinstance(problem, dict):
        problem = {}

    tags = []
    for tag in safe_list(problem.get("tags")):
        tag_text = safe_str(tag)
        if tag_text:
            tags.append(tag_text)

    constraints = []
    for item in safe_list(problem.get("constraints")):
        item_text = safe_str(item)
        if item_text:
            constraints.append(item_text)

    return {
        "task_id": safe_str(problem.get("task_id")),
        "slug": safe_str(problem.get("slug")),
        "title": safe_str(problem.get("title"), "Untitled Problem"),
        "section": safe_str(problem.get("section")),
        "difficulty": safe_str(problem.get("difficulty"), "unknown"),
        "tags": tags,
        "url": safe_str(problem.get("url")),
        "time_limit": safe_str(problem.get("time_limit")),
        "memory_limit": safe_str(problem.get("memory_limit")),
        "statement": safe_str(problem.get("statement")),
        "constraints": constraints,
        "examples": safe_examples(problem.get("examples")),
    }


def load_problems() -> List[Dict[str, Any]]:
    if not PROBLEMS_FILE.exists():
        return []
    try:
        with open(PROBLEMS_FILE, "r", encoding="utf-8") as f:
            raw = json.load(f)
    except Exception:
        return []
    if not isinstance(raw, list):
        return []
    return [normalize_problem(item) for item in raw]


def get_problem_by_task_id(task_id: str) -> Dict[str, Any] | None:
    for problem in load_problems():
        if problem.get("task_id") == str(task_id):
            return problem
    return None


def normalize_text(text: str) -> str:
    return "\n".join(line.rstrip() for line in text.strip().splitlines()).strip()


def run_python(code: str, stdin_data: str) -> Dict[str, Any]:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", dir=TEMP_DIR, delete=False) as f:
        f.write(code)
        file_path = f.name

    try:
        result = subprocess.run(
            ["python3", file_path],
            input=stdin_data,
            capture_output=True,
            text=True,
            timeout=2,
        )
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
            "compile_error": "",
        }
    except subprocess.TimeoutExpired:
        return {
            "stdout": "",
            "stderr": "Execution timed out",
            "returncode": -1,
            "compile_error": "",
        }


def run_cpp(code: str, stdin_data: str) -> Dict[str, Any]:
    with tempfile.TemporaryDirectory(dir=TEMP_DIR) as tmpdir:
        source_path = Path(tmpdir) / "main.cpp"
        binary_path = Path(tmpdir) / "main.out"

        source_path.write_text(code, encoding="utf-8")

        compile_result = subprocess.run(
            ["g++", str(source_path), "-O2", "-std=c++17", "-o", str(binary_path)],
            capture_output=True,
            text=True,
            timeout=10,
        )

        if compile_result.returncode != 0:
            return {
                "stdout": "",
                "stderr": compile_result.stderr,
                "returncode": compile_result.returncode,
                "compile_error": compile_result.stderr,
            }

        try:
            run_result = subprocess.run(
                [str(binary_path)],
                input=stdin_data,
                capture_output=True,
                text=True,
                timeout=2,
            )
            return {
                "stdout": run_result.stdout,
                "stderr": run_result.stderr,
                "returncode": run_result.returncode,
                "compile_error": "",
            }
        except subprocess.TimeoutExpired:
            return {
                "stdout": "",
                "stderr": "Execution timed out",
                "returncode": -1,
                "compile_error": "",
            }


def execute_code(language: str, code: str, stdin_data: str) -> Dict[str, Any]:
    if language == "python":
        return run_python(code, stdin_data)
    if language == "cpp":
        return run_cpp(code, stdin_data)
    return {
        "stdout": "",
        "stderr": f"Unsupported language: {language}",
        "returncode": -1,
        "compile_error": "",
    }


@app.get("/")
def root():
    return {"message": "CSES Code IDE backend running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/problems")
def get_problems():
    problems = load_problems()
    return {"problems": problems, "count": len(problems)}


@app.get("/problems/{task_id}")
def get_problem(task_id: str):
    problem = get_problem_by_task_id(task_id)
    if not problem:
        raise HTTPException(status_code=404, detail=f"Problem not found: {task_id}")
    return problem


@app.post("/run")
def run_code(payload: RunCodeRequest):
    problem = get_problem_by_task_id(payload.task_id)
    if not problem:
        raise HTTPException(status_code=404, detail=f"Problem not found: {payload.task_id}")

    test_cases: List[Dict[str, str]] = []

    if payload.use_examples:
        for example in problem.get("examples", []):
            test_cases.append(
                {
                    "source": "example",
                    "input": safe_str(example.get("input")),
                    "expected_output": safe_str(example.get("output")),
                }
            )

    for case in payload.custom_test_cases:
        test_cases.append(
            {
                "source": "custom",
                "input": safe_str(case.input),
                "expected_output": safe_str(case.expected_output),
            }
        )

    if not test_cases:
        test_cases.append(
            {
                "source": "custom",
                "input": "",
                "expected_output": "",
            }
        )

    results = []
    for index, test_case in enumerate(test_cases, start=1):
        execution = execute_code(payload.language, payload.code, test_case["input"])

        actual_output = normalize_text(execution["stdout"])
        expected_output = normalize_text(test_case["expected_output"])

        passed = False
        if not execution["compile_error"] and execution["returncode"] == 0:
            if expected_output == "":
                passed = True
            else:
                passed = actual_output == expected_output

        results.append(
            {
                "index": index,
                "source": test_case["source"],
                "input": test_case["input"],
                "expected_output": test_case["expected_output"],
                "actual_output": execution["stdout"],
                "stderr": execution["stderr"],
                "returncode": execution["returncode"],
                "compile_error": execution["compile_error"],
                "passed": passed,
            }
        )

    all_passed = all(item["passed"] for item in results)

    return {
        "task_id": payload.task_id,
        "language": payload.language,
        "all_passed": all_passed,
        "results": results,
    }
