import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchProblem, runCode } from "../lib/api";

const PYTHON_TEMPLATE = `n = int(input())
result = []
while n != 1:
    result.append(str(n))
    if n % 2 == 0:
        n //= 2
    else:
        n = 3 * n + 1
result.append("1")
print(" ".join(result))
`;

const CPP_TEMPLATE = `#include <bits/stdc++.h>
using namespace std;

int main() {
    long long n;
    cin >> n;
    while (true) {
        cout << n;
        if (n == 1) break;
        cout << " ";
        if (n % 2 == 0) n /= 2;
        else n = 3 * n + 1;
    }
    return 0;
}
`;

export default function ProblemDetail() {
  const { taskId } = useParams();
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(PYTHON_TEMPLATE);
  const [useExamples, setUseExamples] = useState(true);
  const [customTestCases, setCustomTestCases] = useState([
    { input: "", expected_output: "" },
  ]);
  const [runState, setRunState] = useState({ loading: false, data: null, error: "" });

  useEffect(() => {
    async function loadProblem() {
      try {
        setLoading(true);
        setError("");
        const data = await fetchProblem(taskId);
        setProblem(data);
      } catch {
        setError("Failed to load problem");
      } finally {
        setLoading(false);
      }
    }
    loadProblem();
  }, [taskId]);

  useEffect(() => {
    setCode(language === "python" ? PYTHON_TEMPLATE : CPP_TEMPLATE);
  }, [language, taskId]);

  const visibleExamples = useMemo(() => {
    return Array.isArray(problem?.examples) ? problem.examples : [];
  }, [problem]);

  function updateCustomCase(index, field, value) {
    setCustomTestCases((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function addCustomCase() {
    setCustomTestCases((prev) => [...prev, { input: "", expected_output: "" }]);
  }

  function removeCustomCase(index) {
    setCustomTestCases((prev) =>
      prev.length === 1 ? [{ input: "", expected_output: "" }] : prev.filter((_, i) => i !== index)
    );
  }

  async function handleRun() {
    try {
      setRunState({ loading: true, data: null, error: "" });
      const payload = {
        language,
        code,
        task_id: taskId,
        use_examples: useExamples,
        custom_test_cases: customTestCases,
      };
      const data = await runCode(payload);
      setRunState({ loading: false, data, error: "" });
    } catch (err) {
      setRunState({
        loading: false,
        data: null,
        error: err?.response?.data?.detail || "Failed to run code",
      });
    }
  }

  return (
    <div className="page-shell">
      <div className="detail-topbar">
        <Link to="/" className="back-link">← Back</Link>
        <button className="primary-btn" onClick={handleRun} disabled={runState.loading}>
          {runState.loading ? "Running..." : "Run Code"}
        </button>
      </div>

      {loading && <div className="card">Loading problem...</div>}
      {error && <div className="card error-text">{error}</div>}

      {!loading && !error && problem && (
        <div className="detail-grid">
          <div className="left-panel">
            <div className="card">
              <h1 className="detail-title">{problem.title || "Untitled Problem"}</h1>
              <div className="muted">
                Task ID: {problem.task_id || "-"} · Section: {problem.section || "-"} · Difficulty: {problem.difficulty || "-"}
              </div>
              <div className="muted" style={{ marginTop: 8 }}>
                Time: {problem.time_limit || "-"} · Memory: {problem.memory_limit || "-"}
              </div>

              {Array.isArray(problem.tags) && problem.tags.length > 0 && (
                <div className="tags-row">
                  {problem.tags.map((tag) => (
                    <span key={tag} className="tag-pill">{tag}</span>
                  ))}
                </div>
              )}

              <div className="statement-block">{problem.statement || "No statement available."}</div>

              {Array.isArray(problem.constraints) && problem.constraints.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <h3>Constraints</h3>
                  <ul>
                    {problem.constraints.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {visibleExamples.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <h3>Examples</h3>
                  <div className="examples-grid">
                    {visibleExamples.map((example, idx) => (
                      <div key={idx} className="example-card">
                        <div className="example-label">Input</div>
                        <pre>{example.input || ""}</pre>
                        <div className="example-label">Output</div>
                        <pre>{example.output || ""}</pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="right-panel">
            <div className="card">
              <div className="runner-toolbar">
                <div>
                  <label className="label">Language</label>
                  <select
                    className="select-input"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    <option value="python">Python</option>
                    <option value="cpp">C++</option>
                  </select>
                </div>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={useExamples}
                    onChange={(e) => setUseExamples(e.target.checked)}
                  />
                  Use example test cases
                </label>
              </div>

              <label className="label">Code</label>
              <textarea
                className="code-editor"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
              />

              <div className="custom-tests-header">
                <h3>Custom Test Cases</h3>
                <button className="secondary-btn" onClick={addCustomCase}>Add Test Case</button>
              </div>

              <div className="custom-tests-list">
                {customTestCases.map((testCase, index) => (
                  <div key={index} className="custom-test-card">
                    <div className="custom-test-head">
                      <div>Test Case {index + 1}</div>
                      <button className="danger-btn" onClick={() => removeCustomCase(index)}>
                        Remove
                      </button>
                    </div>

                    <label className="label">Input</label>
                    <textarea
                      className="mini-editor"
                      value={testCase.input}
                      onChange={(e) => updateCustomCase(index, "input", e.target.value)}
                    />

                    <label className="label">Expected Output (optional)</label>
                    <textarea
                      className="mini-editor"
                      value={testCase.expected_output}
                      onChange={(e) => updateCustomCase(index, "expected_output", e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3>Run Results</h3>
              {runState.error && <div className="error-text">{runState.error}</div>}
              {!runState.error && !runState.data && (
                <div className="muted">Run your code to see outputs here.</div>
              )}

              {runState.data && (
                <div className="results-wrap">
                  <div className={runState.data.all_passed ? "pass-banner" : "fail-banner"}>
                    {runState.data.all_passed ? "All visible tests passed" : "Some tests failed"}
                  </div>

                  {Array.isArray(runState.data.results) &&
                    runState.data.results.map((result) => (
                      <div key={result.index} className="result-card">
                        <div className="result-head">
                          <strong>Case {result.index}</strong>
                          <span className={result.passed ? "status-pass" : "status-fail"}>
                            {result.passed ? "PASS" : "FAIL"}
                          </span>
                        </div>
                        <div className="muted">Source: {result.source}</div>

                        <div className="result-block">
                          <div className="example-label">Input</div>
                          <pre>{result.input || ""}</pre>
                        </div>

                        <div className="result-block">
                          <div className="example-label">Expected Output</div>
                          <pre>{result.expected_output || ""}</pre>
                        </div>

                        <div className="result-block">
                          <div className="example-label">Actual Output</div>
                          <pre>{result.actual_output || ""}</pre>
                        </div>

                        <div className="result-block">
                          <div className="example-label">stderr</div>
                          <pre>{result.stderr || ""}</pre>
                        </div>

                        {!!result.compile_error && (
                          <div className="result-block">
                            <div className="example-label">Compile Error</div>
                            <pre>{result.compile_error}</pre>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
