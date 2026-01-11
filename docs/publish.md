# Publishing to npm

Guide for publishing `@fmdz387/cli-ai` to the npm registry.

## Prerequisites

1. **npm account** - Create one at [npmjs.com](https://www.npmjs.com/signup)
2. **Login to npm** - Run `npm login` and follow the prompts
3. **Verify login** - Run `npm whoami` to confirm you're logged in

## Pre-Publish Checklist

Before publishing, ensure:

- [ ] All changes are committed to git
- [ ] Tests pass: `pnpm test`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build`

## Version Management

Update the version in `package.json` before publishing. Follow [Semantic Versioning](https://semver.org/):

- **Patch** (1.0.x): Bug fixes, minor changes
- **Minor** (1.x.0): New features, backward compatible
- **Major** (x.0.0): Breaking changes

### Using npm version command

```bash
# Patch release (3.0.0 → 3.0.1)
npm version patch

# Minor release (3.0.0 → 3.1.0)
npm version minor

# Major release (3.0.0 → 4.0.0)
npm version major

# Specific version
npm version 3.2.0
```

This automatically:
- Updates `package.json`
- Creates a git commit
- Creates a git tag

## Publishing

### Dry Run (Recommended First)

Preview what will be published without actually publishing:

```bash
npm publish --dry-run
```

Review the output to ensure:
- Only intended files are included (check `files` field in package.json)
- Package size is reasonable
- No sensitive files are included

### Publish

```bash
pnpm publish
```

The `prepublishOnly` script automatically runs `pnpm typecheck && pnpm build` before publishing.

Since this is a scoped package (`@fmdz387/cli-ai`), the `publishConfig.access: "public"` setting in package.json ensures it's published as a public package.

### First-Time Publish

If this is the first time publishing this package:

```bash
pnpm publish --access public
```

## Post-Publish Verification

1. **Check npm registry**:
   ```bash
   npm view @fmdz387/cli-ai
   ```

2. **Test installation**:
   ```bash
   # In a temporary directory
   npm install -g @fmdz387/cli-ai
   s --version
   ```

3. **Push git tags**:
   ```bash
   git push origin main --tags
   ```

## Unpublishing

You can unpublish within 72 hours of publishing:

```bash
npm unpublish @fmdz387/cli-ai@<version>
```

To unpublish the entire package (use with caution):

```bash
npm unpublish @fmdz387/cli-ai --force
```

## Deprecating Versions

Instead of unpublishing, consider deprecating old versions:

```bash
npm deprecate @fmdz387/cli-ai@"< 3.0.0" "Upgrade to v3 for latest features"
```

## Troubleshooting

### "You must be logged in"

```bash
npm login
```

### "403 Forbidden" on scoped package

Ensure `publishConfig.access` is set to `public` in package.json, or use:

```bash
pnpm publish --access public
```

### "Version already exists"

Bump the version number:

```bash
npm version patch
```

### Build fails during publish

Run manually to see detailed errors:

```bash
pnpm typecheck
pnpm build
```

## Automated Publishing (CI/CD)

For GitHub Actions, add an npm token as a repository secret (`NPM_TOKEN`) and create a workflow:

```yaml
# .github/workflows/publish.yml
name: Publish to npm

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm publish --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

To generate an npm token:
1. Go to npmjs.com → Access Tokens
2. Generate New Token → Automation
3. Add token to GitHub repository secrets as `NPM_TOKEN`
