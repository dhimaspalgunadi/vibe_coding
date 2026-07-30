export function formatRelativeTime(timestamp) {
  if (!timestamp) return 'belum pernah diubah';

  const diffSec = Math.floor((Date.now() - timestamp) / 1000);

  if (diffSec < 60) return 'diubah baru saja';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `diubah ${diffMin} menit lalu`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `diubah ${diffHour} jam lalu`;

  const diffDay = Math.floor(diffHour / 24);
  return `diubah ${diffDay} hari lalu`;
}
