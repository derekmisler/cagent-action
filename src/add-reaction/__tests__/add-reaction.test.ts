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

vi.mock('@actions/core');

const { mockCreateForIssueComment, mockCreateForPullRequestReviewComment, MockOctokit } =
  vi.hoisted(() => {
    const mockCreateForIssueComment = vi.fn().mockResolvedValue({});
    const mockCreateForPullRequestReviewComment = vi.fn().mockResolvedValue({});

    class MockOctokit {
      rest = {
        reactions: {
          createForIssueComment: mockCreateForIssueComment,
          createForPullRequestReviewComment: mockCreateForPullRequestReviewComment,
        },
      };
    }

    return { mockCreateForIssueComment, mockCreateForPullRequestReviewComment, MockOctokit };
  });

vi.mock('@octokit/rest', () => ({ Octokit: MockOctokit }));

import { addReaction } from '../index.js';

const TOKEN = 'fake-token';
const OWNER = 'docker';
const REPO = 'myrepo';
const COMMENT_ID = 99;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('addReaction — issue comment (default)', () => {
  it('calls createForIssueComment when commentType is omitted', async () => {
    await addReaction(TOKEN, OWNER, REPO, COMMENT_ID, 'eyes');

    expect(mockCreateForIssueComment).toHaveBeenCalledWith({
      owner: OWNER,
      repo: REPO,
      comment_id: COMMENT_ID,
      content: 'eyes',
    });
    expect(mockCreateForPullRequestReviewComment).not.toHaveBeenCalled();
  });

  it('calls createForIssueComment when commentType is "issue" explicitly', async () => {
    await addReaction(TOKEN, OWNER, REPO, COMMENT_ID, '+1', 'issue');

    expect(mockCreateForIssueComment).toHaveBeenCalledWith(
      expect.objectContaining({ content: '+1' }),
    );
    expect(mockCreateForPullRequestReviewComment).not.toHaveBeenCalled();
  });

  it('supports other reaction types (e.g. +1)', async () => {
    await addReaction(TOKEN, OWNER, REPO, COMMENT_ID, '+1');
    expect(mockCreateForIssueComment).toHaveBeenCalledWith(
      expect.objectContaining({ content: '+1' }),
    );
  });

  it('warns and does not throw when the API call fails', async () => {
    mockCreateForIssueComment.mockRejectedValueOnce(new Error('Network error'));

    await expect(addReaction(TOKEN, OWNER, REPO, COMMENT_ID, 'eyes')).resolves.toBeUndefined();
    expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('Network error'));
  });
});

describe('addReaction — pull_request_review comment', () => {
  it('calls createForPullRequestReviewComment when commentType is "pull_request_review"', async () => {
    await addReaction(TOKEN, OWNER, REPO, COMMENT_ID, 'eyes', 'pull_request_review');

    expect(mockCreateForPullRequestReviewComment).toHaveBeenCalledWith({
      owner: OWNER,
      repo: REPO,
      comment_id: COMMENT_ID,
      content: 'eyes',
    });
    expect(mockCreateForIssueComment).not.toHaveBeenCalled();
  });

  it('supports other reaction types for PR review comments', async () => {
    await addReaction(TOKEN, OWNER, REPO, COMMENT_ID, '+1', 'pull_request_review');

    expect(mockCreateForPullRequestReviewComment).toHaveBeenCalledWith(
      expect.objectContaining({ content: '+1' }),
    );
  });

  it('warns and does not throw when the PR review comment API call fails', async () => {
    mockCreateForPullRequestReviewComment.mockRejectedValueOnce(new Error('API error'));

    await expect(
      addReaction(TOKEN, OWNER, REPO, COMMENT_ID, 'eyes', 'pull_request_review'),
    ).resolves.toBeUndefined();
    expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('API error'));
  });
});
