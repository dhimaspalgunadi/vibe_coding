// Tiga status yang tersedia. Urutan di sini juga menentukan urutan tombol pilihan.
export const STATUS_OPTIONS = ['Belum Mulai', 'Dikerjakan', 'Selesai'];

export const MAX_TASK_LENGTH = 60;

// Warna untuk tiap status: merah = belum mulai, kuning = dikerjakan, hijau = selesai.
export const STATUS_STYLES = {
  'Belum Mulai': { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
  Dikerjakan: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  Selesai: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
};
