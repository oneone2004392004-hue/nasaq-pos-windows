/**
 * Utility functions for currency, number, and date formatting
 * strictly conforming to the Database Schema (Minor Units storage).
 */

/**
 * Converts minor currency units (e.g. piasters: 8500) to formatted currency string (e.g. "85.00 ج.م")
 * @param minorUnits integer amount in minor units
 * @param currency symbol or code (default: 'ج.م')
 */
export function formatCurrency(minorUnits: number, currency: string = 'ج.م'): string {
  if (typeof minorUnits !== 'number' || isNaN(minorUnits)) {
    return `0.00 ${currency}`;
  }
  const major = (minorUnits / 100).toFixed(2);
  return `${major} ${currency}`;
}

/**
 * Converts major units to minor units for storage
 */
export function toMinorUnits(majorUnits: number): number {
  return Math.round(majorUnits * 100);
}

/**
 * Format standard integer or decimal numbers
 */
export function formatNumber(value: number): string {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0';
  }
  return new Intl.NumberFormat('ar-EG').format(value);
}

/**
 * Format standard date (DD/MM/YYYY)
 */
export function formatDate(dateInput: string | Date | number): string {
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '-';
  }
}

/**
 * Format standard time (HH:mm AM/PM in Arabic)
 */
export function formatTime(dateInput: string | Date | number): string {
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const period = hours >= 12 ? 'م' : 'ص';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12
    return `${hours}:${minutes} ${period}`;
  } catch {
    return '-';
  }
}

/**
 * Format date and time
 */
export function formatDateTime(dateInput: string | Date | number): string {
  return `${formatDate(dateInput)} - ${formatTime(dateInput)}`;
}
