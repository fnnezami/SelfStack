import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isServerless() {
  return !!(process.env.VERCEL || process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.IS_SERVERLESS);
}
