/** Strip ILIKE wildcards and commas so user input cannot break OR filters. */
export function sanitizeSearchTerm(q: string): string {
  return q.trim().replace(/[%_,]/g, "").slice(0, 80);
}
