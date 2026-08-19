// "Az önce/N dk önce" gibi goreli zaman metni - anlik ozet gosteren yerlerde
// kullaniliyor (Onizleme'deki "Son Calistirmalar", Panel'deki hero karti).
// Denetim/gecmis niteligindeki tam listelerde (ör. /run-history) bunun yerine
// mutlak tarih gosteriliyor.
export function relativeTime(dateIso: string): string {
  const diffMs = Date.now() - new Date(dateIso).getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMin < 1) return 'Az önce';
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} sa önce`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} gün önce`;
}
