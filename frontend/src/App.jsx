import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import ProblemDetail from "./pages/ProblemDetail";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/problems/:taskId" element={<ProblemDetail />} />
    </Routes>
  );
}
