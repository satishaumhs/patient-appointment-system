import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  withCredentials: true,
});

// Without this, a session that expires mid-use (cookie lapsed, server
// restarted) fails silently -- individual pages don't all wrap their data
// loading in a try/catch, so a 401 just leaves the page stuck on "Loading...".
// /auth/* is excluded: /auth/me's 401 on first load is already handled by
// AuthContext (every anonymous visit to a public page hits it), and a failed
// login/register attempt needs to surface its own message, not redirect away
// before the form can show it.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthEndpoint = error.config?.url?.startsWith("/auth/");
    if (error.response?.status === 401 && !isAuthEndpoint && window.location.pathname !== "/login") {
      sessionStorage.setItem("mhs_session_expired", "1");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
