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

import { execSync } from 'node:child_process';
import { afterAll, describe, expect, it } from 'vitest';
import { fetchGitHubAppCredentials } from '../github-app.js';

const OP_REFS = {
  pat: 'op://Team AI Agent/Docker Agent GHA Machine user/PAT',
  orgMembershipToken: 'op://Team AI Agent/Docker Agent GitHub Action/GH org membership token',
};

// CI: env vars already exported by the setup-credentials step
const envCredentials =
  process.env.GITHUB_APP_TOKEN && process.env.ORG_MEMBERSHIP_TOKEN
    ? { pat: process.env.GITHUB_APP_TOKEN, orgMembershipToken: process.env.ORG_MEMBERSHIP_TOKEN }
    : undefined;

// Local dev: read from 1Password
function getOpCredentials() {
  try {
    const pat = execSync(`op read "${OP_REFS.pat}"`, { encoding: 'utf8' }).trim();
    const orgMembershipToken = execSync(`op read "${OP_REFS.orgMembershipToken}"`, {
      encoding: 'utf8',
    }).trim();
    if (pat && orgMembershipToken) return { pat, orgMembershipToken };
  } catch {
    // op not available or not signed in
  }
  return undefined;
}
// Don't call op if CI already has values
const opCredentials = envCredentials ? undefined : getOpCredentials();

const hasAnyCredentials = Boolean(envCredentials ?? opCredentials);

afterAll(() => {
  delete process.env.GITHUB_APP_TOKEN;
  delete process.env.ORG_MEMBERSHIP_TOKEN;
});

// Scenario 1: no credentials at all — verify fetchGitHubAppCredentials throws
describe.skipIf(hasAnyCredentials)(
  'fetchGitHubAppCredentials (integration — AWS unavailable)',
  () => {
    it('throws when AWS credentials are unavailable', async () => {
      await expect(fetchGitHubAppCredentials()).rejects.toThrow('AWS Secrets Manager call failed');
    });
  },
);

// Scenario 2: CI path — env vars already set by setup-credentials, just assert they're present
describe.skipIf(!envCredentials)('fetchGitHubAppCredentials (integration — CI)', () => {
  it('exports GITHUB_APP_TOKEN and ORG_MEMBERSHIP_TOKEN', () => {
    expect(process.env.GITHUB_APP_TOKEN).toBeTruthy();
    expect(process.env.ORG_MEMBERSHIP_TOKEN).toBeTruthy();
  });
});

// Scenario 3: local dev path — validate PAT via GitHub API (no AWS needed)
describe.skipIf(!opCredentials)('fetchGitHubAppCredentials (integration — local dev)', () => {
  // opCredentials is guaranteed non-null inside this describe block
  const creds = opCredentials ?? { pat: '', orgMembershipToken: '' };

  it('PAT resolves to a valid GitHub user', () => {
    const login = execSync(`GH_TOKEN="${creds.pat}" gh api /user --jq '.login'`, {
      encoding: 'utf8',
    }).trim();
    expect(login).toBeTruthy();
  }, 10_000);

  it('org membership token resolves to a valid GitHub user', () => {
    const login = execSync(`GH_TOKEN="${creds.orgMembershipToken}" gh api /user --jq '.login'`, {
      encoding: 'utf8',
    }).trim();
    expect(login).toBeTruthy();
  }, 10_000);
});
