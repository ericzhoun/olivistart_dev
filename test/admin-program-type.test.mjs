import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const readAdmin = () => readFile(new URL("../js/admin.js", import.meta.url), "utf8");

test("admin.js exposes a Program Type select on the programs form", async () => {
  const script = await readAdmin();
  assert.match(script, /\["program_type","Program Type","select"/);
  assert.match(script, /\[\["class","Class"\],\["camp","Camp"\]\]/);
});

test("admin.js form() builder supports select-type fields", async () => {
  const script = await readAdmin();
  assert.match(script, /type === "select"/);
});

test("admin.js shows the program type in the Programs table", async () => {
  const script = await readAdmin();
  assert.match(script, /id === "programs" && key === "program_type"/);
});
