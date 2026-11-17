import { clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge needs to know about the custom type scale and radii so it
// resolves conflicts (e.g. text-sm vs text-paper) correctly.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl'],
      radius: ['card', 'control', 'tick', 'pill'],
      shadow: ['paper', 'float', 'press'],
    },
  },
});

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
