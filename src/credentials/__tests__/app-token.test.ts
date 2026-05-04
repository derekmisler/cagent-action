import * as core from '@actions/core';
import { createAppAuth } from '@octokit/auth-app';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateAppToken } from '../app-token.js';

vi.mock('@actions/core');

const { mockAuth, MockOctokit, mockGetOrgInstallation, mockGetInstallation } = vi.hoisted(() => {
  const mockGetOrgInstallation = vi.fn().mockResolvedValue({ data: { id: 42 } });
  const mockGetInstallation = vi.fn().mockResolvedValue({
    data: {
      permissions: {
        contents: 'write',
        workflows: 'write',
        pull_requests: 'write',
        issues: 'write',
      },
    },
  });

  class MockOctokit {
    apps = {
      getOrgInstallation: mockGetOrgInstallation,
      getInstallation: mockGetInstallation,
    };
  }

  const mockAuth = vi.fn().mockResolvedValue({ token: 'fake-token' });

  return { mockAuth, MockOctokit, mockGetOrgInstallation, mockGetInstallation };
});

vi.mock('@octokit/auth-app', () => ({
  createAppAuth: vi.fn().mockReturnValue(mockAuth),
}));

vi.mock('@octokit/rest', () => ({
  Octokit: MockOctokit,
}));

const MOCK_PERMISSIONS = {
  contents: 'write',
  workflows: 'write',
  pull_requests: 'write',
  issues: 'write',
};

beforeEach(() => {
  vi.clearAllMocks();
  // Re-apply default implementations after clearAllMocks resets them
  mockGetOrgInstallation.mockResolvedValue({ data: { id: 42 } });
  mockGetInstallation.mockResolvedValue({ data: { permissions: MOCK_PERMISSIONS } });
  mockAuth.mockResolvedValue({ token: 'fake-token' });
  vi.mocked(createAppAuth).mockReturnValue(mockAuth as unknown as ReturnType<typeof createAppAuth>);

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

    // Both getOrgInstallation and getUserInstallation throw → outer catch fires
    mockGetOrgInstallation.mockRejectedValueOnce(new Error('not an org'));
    // MockOctokit has no getUserInstallation, so accessing it will throw TypeError,
    // which bubbles up to the outer try/catch as well.

    await generateAppToken();
    expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('Failed to generate'));
    expect(core.exportVariable).not.toHaveBeenCalled();
  });

  it('passes installation permissions to createAppAuth', async () => {
    process.env.GITHUB_APP_ID = 'test-app-id';
    process.env.GITHUB_APP_PRIVATE_KEY = 'FAKE_PRIVATE_KEY_FOR_TESTING';
    process.env.GITHUB_REPOSITORY = 'docker/dagent';

    await generateAppToken();

    // getInstallation was called with the id returned by getOrgInstallation
    expect(mockGetInstallation).toHaveBeenCalledWith({ installation_id: 42 });

    // createAppAuth's auth() was called with the installation's permissions
    expect(mockAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'installation',
        permissions: MOCK_PERMISSIONS,
      }),
    );

    // The token was exported and marked as a secret
    expect(core.setSecret).toHaveBeenCalledWith('fake-token');
    expect(core.exportVariable).toHaveBeenCalledWith('GITHUB_APP_TOKEN', 'fake-token');
  });
});
