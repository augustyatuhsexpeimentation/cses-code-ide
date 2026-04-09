import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchProblems } from "../lib/api";

export default function Home() {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    async function loadProblems() {
      try {
        setLoading(true);
        setError("");
        const data = await fetchProblems();
        setProblems(Array.isArray(data?.problems) ? data.problems : []);
      } catch {
        setError("Failed to load problems");
      } finally {
        setLoading(false);
      }
    }
    loadProblems();
  }, []);

  const filteredProblems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return problems;
    return problems.filter((problem) =>
      [
        problem?.title,
        problem?.task_id,
        problem?.section,
        problem?.difficulty,
        ...(Array.isArray(problem?.tags) ? problem.tags : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [problems, query]);

  return (
    <div className="page-shell">
      <div className="topbar">
        <div>
          <h1>CSES Code IDE</h1>
          <p>Practice CSES with built-in and custom test cases.</p>
        </div>
        <input
          className="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, tag, task id..."
        />
      </div>

      <div className="summary-bar">
        Total loaded: <strong>{problems.length}</strong>
        <span> · </span>
        Showing: <strong>{filteredProblems.length}</strong>
      </div>

      {loading && <div className="card">Loading problems...</div>}
      {error && <div className="card error-text">{error}</div>}

      {!loading && !error && (
        <div className="problem-grid">
          {filteredProblems.map((problem) => (
            <Link
              key={problem.task_id || problem.slug || problem.title}
              to={`/problems/${problem.task_id}`}
              className="problem-card link-card"
            >
              <div className="problem-card-head">
                <div>
                  <div className="problem-title">
                    {problem.title || "Untitled Problem"}
                  </div>
                  <div className="muted">
                    Task ID: {problem.task_id || "-"} · Section: {problem.section || "-"}
                  </div>
                </div>
                <div className="difficulty-pill">
                  {problem.difficulty || "unknown"}
                </div>
              </div>

              <div className="muted">
                Time: {problem.time_limit || "-"} · Memory: {problem.memory_limit || "-"}
              </div>

              {Array.isArray(problem.tags) && problem.tags.length > 0 && (
                <div className="tags-row">
                  {problem.tags.map((tag) => (
                    <span key={tag} className="tag-pill">{tag}</span>
                  ))}
                </div>
              )}

              <div className="statement-preview">
                {(problem.statement || "").slice(0, 220)}
                {(problem.statement || "").length > 220 ? "..." : ""}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
