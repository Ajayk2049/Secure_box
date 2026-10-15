import fs from "fs";
import path from "path";

let cachedHtml: string | null = null;

export function getSimulatorHtml(): string {
  if (cachedHtml) return cachedHtml;

  const candidatePaths = [
    path.join(__dirname, "../public/simulator.html"),
    path.join(__dirname, "../../public/simulator.html"),
    path.join(process.cwd(), "public/simulator.html"),
    path.join(process.cwd(), "backend/public/simulator.html"),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      cachedHtml = fs.readFileSync(candidate, "utf8");
      return cachedHtml;
    }
  }

  // Graceful fallback if static asset is unavailable
  return "<!DOCTYPE html><html><body><h1>Smart Locker Hardware Simulator</h1><p>Asset loading error.</p></body></html>";
}

export const simulatorHtml = getSimulatorHtml();
