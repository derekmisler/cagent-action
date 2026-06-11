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
import { fromWebToken } from '@aws-sdk/credential-provider-web-identity';
import type { AwsCredentialIdentityProvider } from '@aws-sdk/types';

const ROLE_ARN = 'arn:aws:iam::710015040892:role/docker-agent-action-20260409141318957000000001';
const REGION = 'us-east-1';

export async function getAWSCredentials(): Promise<AwsCredentialIdentityProvider | undefined> {
  try {
    const token = await core.getIDToken('sts.amazonaws.com');
    const repo = process.env.GITHUB_REPOSITORY ?? 'unknown';
    const runId = process.env.GITHUB_RUN_ID ?? 'unknown';

    return fromWebToken({
      webIdentityToken: token,
      roleArn: ROLE_ARN,
      roleSessionName: `gha-${repo.replace(/\//g, '-')}-${runId}`.slice(0, 64),
      clientConfig: { region: REGION },
    });
  } catch (err) {
    // id-token: write not available — non-docker repo, graceful no-op
    core.info(`OIDC token unavailable, skipping AWS credentials: ${err}`);
    return undefined;
  }
}
