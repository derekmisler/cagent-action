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
 * CLI entrypoint for the security module.
 *
 * Dispatches on process.argv[2] (subcommand):
 *   check-auth   <association> <allowed-roles-json>
 *   sanitize-input  <inputPath> <outputPath>
 *   sanitize-output <filePath>
 *
 * Writes GitHub Actions outputs via @actions/core.setOutput and exits 1
 * when the operation blocks execution (auth failure, blocked prompt, leaked secret).
 */
import * as core from '@actions/core';
import { checkAuth } from './check-auth.js';
import { sanitizeInput } from './sanitize-input.js';
import { sanitizeOutput } from './sanitize-output.js';

const subcommand = process.argv[2];

if (subcommand === 'check-auth') {
  const association = process.argv[3] ?? '';
  const rolesJson = process.argv[4] ?? '[]';

  let allowedRoles: string[];
  try {
    allowedRoles = JSON.parse(rolesJson) as string[];
  } catch {
    core.setFailed(`Invalid JSON for allowed-roles: ${rolesJson}`);
    process.exit(1);
  }

  const authorized = checkAuth(association, allowedRoles);
  core.setOutput('authorized', String(authorized));

  if (!authorized) {
    process.exit(1);
  }
} else if (subcommand === 'sanitize-input') {
  const inputPath = process.argv[3];
  const outputPath = process.argv[4];

  if (!inputPath || !outputPath) {
    core.setFailed('sanitize-input requires <inputPath> <outputPath>');
    process.exit(1);
  }

  const result = sanitizeInput(inputPath, outputPath);
  core.setOutput('blocked', String(result.blocked));
  core.setOutput('stripped', String(result.stripped));
  core.setOutput('risk-level', result.riskLevel);

  if (result.blocked) {
    process.exit(1);
  }
} else if (subcommand === 'sanitize-output') {
  const filePath = process.argv[3];

  if (!filePath) {
    core.setFailed('sanitize-output requires <filePath>');
    process.exit(1);
  }

  const result = sanitizeOutput(filePath);
  core.setOutput('leaked', String(result.leaked));

  if (result.leaked) {
    process.exit(1);
  }
} else {
  core.setFailed(`Unknown subcommand: ${subcommand ?? '(none)'}`);
  process.exit(1);
}
