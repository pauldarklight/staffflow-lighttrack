export function formatCurrency(amount) {
  if (amount == null) return '€0,00';
  return new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(amount);
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function getMonthName(month) {
  const months = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'];
  return months[(month - 1)] || '';
}

export function getQuarter(month) {
  if (month <= 3) return 'Q1';
  if (month <= 6) return 'Q2';
  if (month <= 9) return 'Q3';
  return 'Q4';
}