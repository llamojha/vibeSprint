export function stripAnsi(text: string): string {
  // Handle all ANSI escape sequences: colors, cursor control, etc.
  return text.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '');
}
