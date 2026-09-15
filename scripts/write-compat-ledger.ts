#!/usr/bin/env bun
/**
 * Generate docs/evidence/UPSTREAM_COMPAT.md from Keli inventory.
 * Catalog membership is not a live connection.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderCompatLedger } from "../src/integrations/compat-ledger.ts";

const dest = join(import.meta.dir, "../docs/evidence/UPSTREAM_COMPAT.md");
writeFileSync(dest, renderCompatLedger());
console.log(`Wrote ${dest}`);
