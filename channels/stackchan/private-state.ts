import { chmodSync, existsSync, lstatSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export function privateDirectory(path: string) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (process.getuid && stat.uid !== process.getuid()))
    throw new Error("Private state directory must be an owned directory, not a link");
  chmodSync(path, 0o700);
  return path;
}

export function writePrivate(path: string, data: string | Uint8Array) {
  privateDirectory(dirname(path));
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error("Refusing linked state file");
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, data, { mode: 0o600, flag: "wx" });
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}
