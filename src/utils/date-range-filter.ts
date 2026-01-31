export const addDateRangeFilter = (filters: Record<string, unknown>[], field: string, value_from?: string, value_to?: string) => {
  if (value_from?.trim() || value_to?.trim()) {
    const range: Record<string, unknown> = {};
    if (value_from?.trim()) {
      range['$gte'] = value_from?.trim();
    }
    if (value_to?.trim()) {
      range['$lte'] = value_to?.trim();
    }
    filters.push({ [field]: range });
  }
};