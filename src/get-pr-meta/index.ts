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
 * get-pr-meta — fetch core metadata for a GitHub pull request.
 *
 * Exported function: getPrMeta(token, owner, repo, prNumber) → PrMeta
 *
 * Outputs: title, body, author-login, base-ref-name
 */
import { Octokit } from '@octokit/rest';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PrMeta {
  title: string;
  body: string;
  authorLogin: string;
  baseRefName: string;
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Fetch title, description, author, and base branch for pull request `prNumber`.
 */
export async function getPrMeta(
  token: string,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<PrMeta> {
  const octokit = new Octokit({ auth: token });
  const { data } = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber });
  return {
    title: data.title,
    body: data.body ?? 'No description provided.',
    authorLogin: data.user?.login ?? 'unknown',
    baseRefName: data.base.ref,
  };
}
