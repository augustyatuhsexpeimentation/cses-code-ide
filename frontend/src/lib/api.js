import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

export async function fetchProblems() {
  const response = await api.get("/problems");
  return response.data;
}

export async function fetchProblem(taskId) {
  const response = await api.get(`/problems/${taskId}`);
  return response.data;
}

export async function runCode(payload) {
  const response = await api.post("/run", payload);
  return response.data;
}
