import axios from "axios";

//export const baseURL = "https://localhost:7245";
export const baseURL = "http://rtca-e-monitoring-web-api.runasp.net";

const axiosInstance = axios.create({
  baseURL: baseURL + "/api/",
  timeout: 30000,
  headers: { "X-Custom-Header": "foobar" },
});

// Add a request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("jwt_token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

export default axiosInstance;
