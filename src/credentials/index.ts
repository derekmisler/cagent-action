import * as core from '@actions/core';
import { fetchAIApiKeys } from './ai-keys.js';
import { generateAppToken } from './app-token.js';
import { getAWSCredentials } from './aws-credentials.js';
import { fetchGitHubAppCredentials } from './github-app.js';

async function run(): Promise<void> {
  const credentials = await getAWSCredentials();
  await fetchGitHubAppCredentials(credentials);
  await fetchAIApiKeys(credentials);
  await generateAppToken();
}

run().catch(core.setFailed);
