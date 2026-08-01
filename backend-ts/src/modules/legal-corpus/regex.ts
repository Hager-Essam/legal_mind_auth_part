// Shared regex helper functions

/** Escapes special regex characters in a string */
export const escapeRegex = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
