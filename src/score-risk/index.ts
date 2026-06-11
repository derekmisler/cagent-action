// Copyright The Docker Agent Action Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * score-risk CLI entrypoint.
 *
 * Usage:
 *   node dist/score-risk.js <diffPath> <excludePathsList>
 *
 *   diffPath         Path to the diff file (read-only).
 *   excludePathsList Newline-separated list of path prefixes to score as 0.
 *
 * Writes a JSON object { "<filePath>": <score>, … } to /tmp/file_risk_scores.json.
 * The consuming step reads it with:
 *   echo "✅ File risk scores: $(jq -c . /tmp/file_risk_scores.json)"
 *
 * See score-risk.ts for the scoring rules and pure-function logic.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseExcludePrefixes, scoreFiles } from './score-risk.js';

const SCORES_OUTPUT_PATH = '/tmp/file_risk_scores.json';

const [, , diffPath, excludePathsArg] = process.argv;

if (!diffPath) {
  process.stderr.write('Usage: score-risk <diffPath> <excludePaths>\n');
  process.exit(1);
}

try {
  const diffContent = readFileSync(diffPath, 'utf-8');
  const prefixes = parseExcludePrefixes(excludePathsArg ?? '');
  const scores = scoreFiles(diffContent, prefixes);
  writeFileSync(SCORES_OUTPUT_PATH, JSON.stringify(scores), 'utf-8');
} catch (err) {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}
