import * as core from '@actions/core';
import { Octokit } from '@octokit/rest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateAppToken } from '../app-token.js';

vi.mock('@actions/core');
vi.mock('@octokit/auth-app', () => ({
  createAppAuth: vi.fn().mockReturnValue(vi.fn().mockResolvedValue({ token: 'fake-token' })),
}));
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.GITHUB_APP_ID;
  delete process.env.GITHUB_APP_PRIVATE_KEY;
  delete process.env.GITHUB_REPOSITORY;
});

describe('generateAppToken', () => {
  it('returns early and logs info when credentials are not set', async () => {
    await generateAppToken();
    expect(core.exportVariable).not.toHaveBeenCalled();
    expect(core.info).toHaveBeenCalledWith(expect.stringContaining('not available'));
  });

  it('warns and continues when Octokit throws', async () => {
    process.env.GITHUB_APP_ID = 'test-app-id';
    process.env.GITHUB_APP_PRIVATE_KEY = 'FAKE_PRIVATE_KEY_FOR_TESTING';
    process.env.GITHUB_REPOSITORY = 'docker/dagent';

    class ThrowingOctokit {
      constructor() {
        throw new Error('API error');
      }
    }
    vi.mocked(Octokit).mockImplementation(ThrowingOctokit as unknown as typeof Octokit);

    await generateAppToken();
    expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('Failed to generate'));
    expect(core.exportVariable).not.toHaveBeenCalled();
  });
});
