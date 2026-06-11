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
import { fetchAIApiKeys } from './ai-keys.js';
import { getAWSCredentials } from './aws-credentials.js';
import { fetchGitHubAppCredentials } from './github-app.js';

async function run(): Promise<void> {
  const credentials = await getAWSCredentials();
  await fetchGitHubAppCredentials(credentials);
  await fetchAIApiKeys(credentials);
}

run().catch(core.setFailed);
