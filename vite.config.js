import { defineConfig, loadEnv } from 'vite';

function getBasePath(env) {
  const configuredBase = process.env.VITE_BASE_PATH || env.VITE_BASE_PATH;
  if (configuredBase) return configuredBase.endsWith('/') ? configuredBase : configuredBase + '/';

  // GitHub Pages project sites are served from /<repository>/; user/organization
  // sites and static hosts such as Vercel or Netlify are served from /.
  const repositoryName = process.env.GITHUB_REPOSITORY?.split('/').pop() || '';
  const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === 'true';
  if (isGitHubPagesBuild && repositoryName && !repositoryName.endsWith('.github.io')) {
    return '/' + repositoryName + '/';
  }
  return '/';
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: getBasePath(env),
    server: {
      host: '0.0.0.0',
      port: 5173
    }
  };
});
