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
 * summary.ts — write GitHub Actions job summary.
 *
 * Ports the summary-writing logic from the `Run Docker Agent` step and the
 * `Update job summary with cleaned output` step of the original composite action.yml.
 *
 * The original writes two sections:
 *   1. An execution summary table (created after run)
 *   2. A cleaned agent output section appended after sanitization
 *
 * This module combines both into a single write, called after sanitization.
 */

import * as fs from 'node:fs';
import * as core from '@actions/core';

export interface WriteSummaryOptions {
  agent: string;
  exitCode: number;
  executionTime: number;
  cagentVersion: string;
  mcpInstalled: boolean;
  timeout: number;
  /** Path to the cleaned output file (may not exist if agent failed early). */
  outputFile?: string;
}

/**
 * Write (or append to) the GitHub Actions job summary with execution details
 * and the cleaned agent output.
 *
 * Safe to call when outputFile is absent — will skip the output section.
 */
export async function writeJobSummary(opts: WriteSummaryOptions): Promise<void> {
  const { agent, exitCode, executionTime, cagentVersion, mcpInstalled, timeout, outputFile } = opts;

  let statusLine: string;
  if (exitCode === 0) {
    statusLine = '✅ **Status:** Success';
  } else if (exitCode === 124) {
    statusLine = '⏱️ **Status:** Timeout';
  } else {
    statusLine = '❌ **Status:** Failed';
  }

  const rows = [
    `| Agent | \`${agent}\` |`,
    `| Exit Code | ${exitCode} |`,
    `| Execution Time | ${executionTime}s |`,
    `| Docker Agent Version | ${cagentVersion} |`,
    `| MCP Gateway | ${mcpInstalled} |`,
  ];
  if (timeout > 0) {
    rows.push(`| Timeout | ${timeout}s |`);
  }

  core.summary
    .addHeading('Docker Agent Execution Summary', 2)
    .addRaw('\n')
    .addTable([
      [
        { data: 'Property', header: true },
        { data: 'Value', header: true },
      ],
      ...rows.map((row) => {
        // Parse "| Key | Value |" into [key, value]
        const cells = row
          .split('|')
          .map((c) => c.trim())
          .filter((c) => c.length > 0);
        return cells.map((c) => ({ data: c }));
      }),
    ])
    .addRaw('\n')
    .addRaw(`${statusLine}\n`);

  // Append cleaned agent output (if available)
  if (outputFile) {
    let outputContent = '';
    try {
      outputContent = fs.readFileSync(outputFile, 'utf-8');
    } catch {
      // File not available — skip output section
    }

    if (outputContent.trim()) {
      core.summary.addRaw('\n<hr />\n\n<h2>Agent Output</h2>\n\n').addRaw(`${outputContent}\n`);
    }
  }

  await core.summary.write();
}
