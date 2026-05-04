export const cedi = (n: number) =>
  `₵${n.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const shortDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" });
};

export const genRef = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `BD-${s}`;
};

export const genCode = (len = 8) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};

export const genApiKey = () =>
  "bd_live_" + Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

// Convert a size label like "500MB", "1GB", "1.5 GB" to MB for sorting.
export const sizeToMB = (s: string): number => {
  if (!s) return 0;
  const m = s.trim().match(/([\d.]+)\s*(GB|MB|TB|KB)?/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = (m[2] || "MB").toUpperCase();
  const mult = unit === "TB" ? 1024 * 1024 : unit === "GB" ? 1024 : unit === "KB" ? 1 / 1024 : 1;
  return n * mult;
};