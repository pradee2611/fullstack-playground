const { exec } = require('child_process');
const { promisify } = require('util');
const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');

const execAsync = promisify(exec);

class GitHubService {
  constructor() {
    this.clientId = process.env.GITHUB_CLIENT_ID;
    this.clientSecret = process.env.GITHUB_CLIENT_SECRET;
    this.baseUrl = 'https://api.github.com';
  }

  /**
   * Get GitHub OAuth URL
   */
  getOAuthUrl(redirectUri, state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: 'repo user',
      state: state,
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange code for access token
   */
  async exchangeCodeForToken(code) {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('GitHub OAuth not configured');
    }

    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
      },
      {
        headers: { Accept: 'application/json' },
      }
    );

    return response.data.access_token;
  }

  /**
   * Get authenticated user info
   */
  async getUserInfo(token) {
    const response = await axios.get(`${this.baseUrl}/user`, {
      headers: { Authorization: `token ${token}` },
    });
    return response.data;
  }

  /**
   * Clone repository into workspace
   */
  async cloneRepository(repoUrl, workspaceId, options = {}) {
    const workspacePath = path.join(__dirname, '../workspaces', workspaceId);
    
    // Ensure workspace directory exists
    await fs.mkdir(workspacePath, { recursive: true });

    const { branch = 'main', token = null } = options;

    try {
      // Build clone URL with token if provided
      let cloneUrl = repoUrl;
      if (token && repoUrl.includes('github.com')) {
        // Add token to URL for private repos
        cloneUrl = repoUrl.replace(
          'https://github.com/',
          `https://${token}@github.com/`
        );
      }

      // Clone repository
      const git = simpleGit(workspacePath);
      await git.clone(cloneUrl, workspacePath, ['--depth', '1']);

      // Checkout specific branch if provided
      if (branch && branch !== 'main') {
        await git.checkout(branch);
      }

      // Get repository info
      const remoteUrl = await git.listRemote(['--get-url']);
      const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);

      return {
        success: true,
        path: workspacePath,
        remoteUrl,
        branch: currentBranch,
      };
    } catch (error) {
      throw new Error(`Failed to clone repository: ${error.message}`);
    }
  }

  /**
   * Get repository information without cloning
   */
  async getRepoInfo(repoUrl) {
    try {
      // Parse GitHub URL
      const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) {
        throw new Error('Invalid GitHub URL');
      }

      const [, owner, repo] = match;
      const repoName = repo.replace('.git', '');

      // Fetch repository info from GitHub API
      const response = await axios.get(
        `${this.baseUrl}/repos/${owner}/${repoName}`,
        {
          headers: this.clientId
            ? { Authorization: `token ${process.env.GITHUB_TOKEN}` }
            : {},
        }
      );

      return {
        owner,
        repo: repoName,
        name: response.data.name,
        description: response.data.description,
        language: response.data.language,
        defaultBranch: response.data.default_branch,
        private: response.data.private,
        stars: response.data.stargazers_count,
        forks: response.data.forks_count,
      };
    } catch (error) {
      // If API fails, try to infer from URL
      const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (match) {
        const [, owner, repo] = match;
        return {
          owner,
          repo: repo.replace('.git', ''),
          defaultBranch: 'main',
        };
      }
      throw error;
    }
  }

  /**
   * Commit and push changes back to GitHub
   */
  async commitAndPush(workspaceId, message, options = {}) {
    const workspacePath = path.join(__dirname, '../workspaces', workspaceId);
    const git = simpleGit(workspacePath);

    const { branch = 'main', token = null } = options;

    try {
      // Check if there are changes
      const status = await git.status();
      if (status.files.length === 0) {
        return { success: true, message: 'No changes to commit' };
      }

      // Add all changes
      await git.add('.');

      // Commit
      await git.commit(message);

      // Push (with token if provided)
      if (token) {
        const remoteUrl = await git.listRemote(['--get-url']);
        const authUrl = remoteUrl.replace(
          'https://github.com/',
          `https://${token}@github.com/`
        );
        await git.addRemote('origin-auth', authUrl);
        await git.push(['origin-auth', branch]);
        await git.removeRemote('origin-auth');
      } else {
        await git.push('origin', branch);
      }

      return { success: true, message: 'Changes pushed successfully' };
    } catch (error) {
      throw new Error(`Failed to commit and push: ${error.message}`);
    }
  }

  /**
   * Create a pull request
   */
  async createPullRequest(repoUrl, title, body, headBranch, baseBranch = 'main', token) {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error('Invalid GitHub URL');
    }

    const [, owner, repo] = match;
    const repoName = repo.replace('.git', '');

    const response = await axios.post(
      `${this.baseUrl}/repos/${owner}/${repoName}/pulls`,
      {
        title,
        body,
        head: headBranch,
        base: baseBranch,
      },
      {
        headers: { Authorization: `token ${token}` },
      }
    );

    return response.data;
  }

  /**
   * List user repositories
   */
  async listUserRepos(token, options = {}) {
    const { type = 'all', sort = 'updated' } = options;

    const response = await axios.get(`${this.baseUrl}/user/repos`, {
      params: { type, sort, per_page: 100 },
      headers: { Authorization: `token ${token}` },
    });

    return response.data.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      language: repo.language,
      private: repo.private,
      url: repo.html_url,
      cloneUrl: repo.clone_url,
      defaultBranch: repo.default_branch,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      updatedAt: repo.updated_at,
    }));
  }
}

module.exports = new GitHubService();




