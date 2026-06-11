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
 * filter-diff CLI entrypoint.
 *
 * Usage:
 *   node dist/filter-diff.js <diffPath> <excludePathsList>
 *
 *   diffPath         Path to the diff file (read and overwritten in-place).
 *   excludePathsList Newline-separated list of path prefixes to exclude.
 *
 * All diff section types are handled correctly:
 *   - Modifications  detected via `+++ b/<path>`
 *   - Deletions      detected via `--- a/<path>` (+++ is /dev/null)
 *   - Pure renames   detected via `rename to <path>` (no --- or +++ present)
 *
 * When all sections are excluded the file is deleted so `hashFiles()` in
 * GitHub Actions returns `''` and downstream `if: hashFiles('pr.diff') != ''`
 * guards fire correctly.
 *
 * See filter-diff.ts for the pure filtering logic and I/O wrapper.
 */
import { applyFilter } from './filter-diff.js';

const [, , diffPath, excludePathsArg] = process.argv;

if (!diffPath) {
  process.stderr.write('Usage: filter-diff <diffPath> <excludePaths>\n');
  process.exit(1);
}

try {
  applyFilter(diffPath, excludePathsArg ?? '');
} catch (err) {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}
