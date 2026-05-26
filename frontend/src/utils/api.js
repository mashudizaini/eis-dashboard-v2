import axios from 'axios';
import useAuthStore from '../stores/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8001',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().keycloak.login();
    }
    return Promise.reject(error);
  }
);

const EIS_PREFIX = '/api/v1/eis';

export const eisApi = {
  // Summary
  getKpiCards: (year, period) => api.get(`${EIS_PREFIX}/summary/kpi-cards`, { params: { year, period } }),
  getPortfolio: (params) => api.get(`${EIS_PREFIX}/summary/portfolio`, { params }),
  getClosingEstimation: (year, period) => api.get(`${EIS_PREFIX}/summary/closing-estimation`, { params: { year, period } }),
  getNwc: (year, period) => api.get(`${EIS_PREFIX}/summary/nwc`, { params: { year, period } }),

  // Performance
  getSalesAchievement: (year, segment) => api.get(`${EIS_PREFIX}/performance/sales-achievement`, { params: { year, segment } }),
  getMonthlySales: (year, segment) => api.get(`${EIS_PREFIX}/performance/monthly-sales`, { params: { year, segment } }),
  getSalesGrowth: (year, segment) => api.get(`${EIS_PREFIX}/performance/growth`, { params: { year, segment } }),
  getEbitProduct: (year, period) => api.get(`${EIS_PREFIX}/performance/ebit-product`, { params: { year, period } }),
  getAreaSales: (year, period) => api.get(`${EIS_PREFIX}/performance/area-sales`, { params: { year, period } }),
  getMarketing: (year) => api.get(`${EIS_PREFIX}/performance/marketing`, { params: { year } }),
  getForecast: (year, period, segment) => api.get(`${EIS_PREFIX}/performance/forecast`, { params: { year, period, segment } }),

  // Production
  getBatchProduction: (year) => api.get(`${EIS_PREFIX}/production/batch`, { params: { year } }),
  getYieldProduction: (year) => api.get(`${EIS_PREFIX}/production/yield`, { params: { year } }),
  getDio: (year) => api.get(`${EIS_PREFIX}/production/dio`, { params: { year } }),
  getCogsRatio: (year, period) => api.get(`${EIS_PREFIX}/production/cogs-ratio`, { params: { year, period } }),
  getOvertime: (year) => api.get(`${EIS_PREFIX}/production/overtime`, { params: { year } }),
  getReleaseTime: (year) => api.get(`${EIS_PREFIX}/production/release-time`, { params: { year } }),

  // Expansion
  getPipeline: (year) => api.get(`${EIS_PREFIX}/expansion/pipeline`, { params: { year } }),
  getPipelineSummary: (year, period) => api.get(`${EIS_PREFIX}/expansion/pipeline-summary`, { params: { year, period } }),

  // Administration
  getHeadcount: (year) => api.get(`${EIS_PREFIX}/admin/headcount`, { params: { year } }),
  getTurnover: (year) => api.get(`${EIS_PREFIX}/admin/turnover`, { params: { year } }),
  getProfit: (year) => api.get(`${EIS_PREFIX}/admin/profit`, { params: { year } }),
  getCashflow: (year) => api.get(`${EIS_PREFIX}/admin/cashflow`, { params: { year } }),
  getRatios: (year) => api.get(`${EIS_PREFIX}/admin/ratios`, { params: { year } }),
  getBudget: (year) => api.get(`${EIS_PREFIX}/admin/budget`, { params: { year } }),

  // Business Plan
  getBpList: (year, planType) => api.get(`${EIS_PREFIX}/bp/list`, { params: { year, plan_type: planType } }),
  saveBp: (data) => api.post(`${EIS_PREFIX}/bp/save`, data),
  deleteBp: (id) => api.delete(`${EIS_PREFIX}/bp/${id}`),
  getBpTypes: () => api.get(`${EIS_PREFIX}/bp/types`),

  // ETL
  getEtlStatus: () => api.get(`${EIS_PREFIX}/etl/status`),
  triggerEtl: (jobName, params) => api.post(`${EIS_PREFIX}/etl/trigger/${jobName}`, params),
  stopEtl: (jobName) => api.post(`${EIS_PREFIX}/etl/stop/${jobName}`),
  getEtlSchedule: () => api.get(`${EIS_PREFIX}/etl/schedule`),
  getEtlJobData: (jobName, year, month) => api.get(`${EIS_PREFIX}/etl/job-data/${jobName}`, { params: { year, month: month || undefined } }),

  // Daily Sales
  getDailySales: () => api.get(`${EIS_PREFIX}/daily-sales/data`),
  uploadDailySales: (formData) => api.post(`${EIS_PREFIX}/daily-sales/upload`, formData),

  // Data Upload
  getOvertimeData: (year) => api.get(`${EIS_PREFIX}/data-upload/overtime`, { params: { year } }),
  uploadOvertimeData: (year, formData) => api.post(`${EIS_PREFIX}/data-upload/overtime/upload`, formData, { params: { year } }),
  getCogsUploadData: (year, period) => api.get(`${EIS_PREFIX}/data-upload/cogs`, { params: { year, period } }),
  uploadCogsData: (year, formData) => api.post(`${EIS_PREFIX}/data-upload/cogs/upload`, formData, { params: { year } }),
  getSalesBP: (year) => api.get(`${EIS_PREFIX}/data-upload/sales-bp`, { params: { year } }),
  uploadSalesBP: (year, formData) => api.post(`${EIS_PREFIX}/data-upload/sales-bp/upload`, formData, { params: { year } }),
};

export default api;
