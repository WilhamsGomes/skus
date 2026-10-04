const CYAN = '\x1b[36m';
const DEFAULT_COLOR = '\x1b[39m';

const colorsEnabled = !process.env.NO_COLOR && process.stdout.isTTY === true;

export function highlight(text: string): string {
  return colorsEnabled ? `${CYAN}${text}${DEFAULT_COLOR}` : text;
}
