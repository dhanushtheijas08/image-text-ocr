import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { createWorker } from "tesseract.js";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
