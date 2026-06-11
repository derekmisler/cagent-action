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
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAIApiKeys } from '../ai-keys.js';

vi.mock('@actions/core');

const { mockSend, MockSecretsManagerClient } = vi.hoisted(() => {
  const mockSend = vi.fn();
  class MockSecretsManagerClient {
    send = mockSend;
  }
  return { mockSend, MockSecretsManagerClient };
});

vi.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: MockSecretsManagerClient,
  GetSecretValueCommand: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

describe('fetchAIApiKeys', () => {
  it('exports both keys when both are present', async () => {
    mockSend.mockResolvedValue({
      SecretString: JSON.stringify({
        anthropic_api_key: 'ant-key',
        openai_api_key: 'oai-key',
      }),
    });
    await fetchAIApiKeys();
    expect(core.exportVariable).toHaveBeenCalledWith('ANTHROPIC_API_KEY_FROM_SSM', 'ant-key');
    expect(core.exportVariable).toHaveBeenCalledWith('OPENAI_API_KEY_FROM_SSM', 'oai-key');
  });

  it('exports only anthropic when openai is absent', async () => {
    mockSend.mockResolvedValue({
      SecretString: JSON.stringify({ anthropic_api_key: 'ant-key' }),
    });
    await fetchAIApiKeys();
    expect(core.exportVariable).toHaveBeenCalledWith('ANTHROPIC_API_KEY_FROM_SSM', 'ant-key');
    expect(core.exportVariable).not.toHaveBeenCalledWith(
      'OPENAI_API_KEY_FROM_SSM',
      expect.anything(),
    );
  });

  it('warns and returns gracefully when AWS is unavailable', async () => {
    mockSend.mockRejectedValue(new Error('network error'));
    await expect(fetchAIApiKeys()).resolves.toBeUndefined();
    expect(core.exportVariable).not.toHaveBeenCalled();
  });

  it('warns and returns gracefully on invalid JSON', async () => {
    mockSend.mockResolvedValue({ SecretString: 'not-json' });
    await expect(fetchAIApiKeys()).resolves.toBeUndefined();
    expect(core.warning).toHaveBeenCalled();
    expect(core.exportVariable).not.toHaveBeenCalled();
  });
});
