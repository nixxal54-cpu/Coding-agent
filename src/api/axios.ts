// src/api/axios.ts
import axios from "axios";
const instance = axios.create({ baseURL: "/" }); // relative — proxy handles it in dev, same-origin in prod
export default instance;
