export function makeSlug(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[\u0600-\u06FF]+/g, (m) => m) // keep Arabic
    .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  if (base) return base;
  return "item-" + Math.random().toString(36).slice(2, 10);
}
