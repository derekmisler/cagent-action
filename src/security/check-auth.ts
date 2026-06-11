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

import * as core from '@actions/core';

/**
 * Check if a user's association role is in the list of allowed roles.
 * Mirrors the jq-based check in security/check-auth.sh (exact string match).
 *
 * @param association - The user's GitHub author_association (e.g. "OWNER")
 * @param allowedRoles - Array of allowed role strings from action input
 * @returns true if authorized, false otherwise (also emits core.error on failure)
 */
export function checkAuth(association: string, allowedRoles: string[]): boolean {
  const authorized = allowedRoles.includes(association);

  if (authorized) {
    core.info('✅ Authorization successful');
    core.info(`   User role '${association}' is allowed`);
    return true;
  }

  core.error('═══════════════════════════════════════════════════════');
  core.error('❌ AUTHORIZATION FAILED');
  core.error('═══════════════════════════════════════════════════════');
  core.error('');
  core.error(`User association: ${association}`);
  core.error(`Allowed roles: ${JSON.stringify(allowedRoles)}`);
  core.error('');
  core.error('Only trusted contributors can trigger reviews.');
  core.error('Allowed: OWNER, MEMBER, COLLABORATOR');
  core.error('External contributors cannot use this action.');
  core.error('');
  core.error('If you are a maintainer, ensure you have appropriate');
  core.error('permissions in the repository.');
  core.error('═══════════════════════════════════════════════════════');
  return false;
}
