import { create } from 'zustand';

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth(); // 0-indexed, so previous month for EIS

const useDashboardStore = create((set) => ({
  year: currentYear,
  period: currentMonth || 12, // default to last month, or December if January
  segment: 'all',

  setYear: (year) => set({ year }),
  setPeriod: (period) => set({ period }),
  setSegment: (segment) => set({ segment }),
}));

export default useDashboardStore;
