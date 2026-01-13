import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export class NeverError extends Error {
  constructor(value: never) {
    super(`Unexpected value: ${JSON.stringify(value)}`);
  }
}
