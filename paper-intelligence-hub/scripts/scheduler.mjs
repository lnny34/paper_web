import cron from "node-cron";
import { spawn } from "node:child_process";

const schedule = process.env.PAPER_DAILY_CRON || "0 8 * * *";
const timezone = process.env.PAPER_TIMEZONE || "Asia/Shanghai";

function runFetch(reason) {
  console.log(`[${new Date().toISOString()}] ${reason}: fetching latest papers`);
  const child = spawn("npm", ["run", "fetch:papers"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  child.on("exit", (code) => {
    console.log(`[${new Date().toISOString()}] fetch finished with code ${code}`);
  });
}

runFetch("startup");

cron.schedule(
  schedule,
  () => {
    runFetch("daily schedule");
  },
  { timezone },
);

console.log(`Paper scheduler active: ${schedule} (${timezone})`);
