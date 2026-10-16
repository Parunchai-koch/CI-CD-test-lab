import { cp, rm } from "node:fs/promises";

await rm("backend/public", { recursive: true, force: true });
await cp("frontend/dist", "backend/public", { recursive: true });
