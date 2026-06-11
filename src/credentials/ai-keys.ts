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
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import type { AwsCredentialIdentityProvider } from '@aws-sdk/types';

const SECRET_ID = 'docker-agent-action/ai-api-keys';
const REGION = 'us-east-1';

interface AIApiKeysSecret {
  anthropic_api_key?: string;
  openai_api_key?: string;
}

export async function fetchAIApiKeys(credentials?: AwsCredentialIdentityProvider): Promise<void> {
  const client = new SecretsManagerClient({ region: REGION, credentials });

  let secretJson: string;
  try {
    const res = await client.send(new GetSecretValueCommand({ SecretId: SECRET_ID }));
    secretJson = res.SecretString ?? '';
  } catch (err) {
    core.warning(`AWS Secrets Manager unavailable, skipping ${SECRET_ID}: ${err}`);
    return;
  }

  core.setSecret(secretJson);

  let secret: AIApiKeysSecret;
  try {
    secret = JSON.parse(secretJson) as AIApiKeysSecret;
  } catch {
    core.warning(`${SECRET_ID} did not return valid JSON; AI API keys will be empty`);
    return;
  }

  if (secret.anthropic_api_key) {
    core.setSecret(secret.anthropic_api_key);
    core.exportVariable('ANTHROPIC_API_KEY_FROM_SSM', secret.anthropic_api_key);
  }
  if (secret.openai_api_key) {
    core.setSecret(secret.openai_api_key);
    core.exportVariable('OPENAI_API_KEY_FROM_SSM', secret.openai_api_key);
  }
}
