# Node.js Update Required

## Important: Update Node.js to 20.18.1+

The latest version of `@distube/ytdl-core` (4.16.12) requires Node.js 20.18.1 or higher to work properly with YouTube's current page structure.

### Your Current Setup
- **Current Node.js**: 20.11.0
- **Required Node.js**: 20.18.1+
- **Library Version**: 4.16.12 (latest, fixes parsing errors)

### How to Update Node.js

#### Option 1: Download from nodejs.org (Easiest)
1. Go to [nodejs.org](https://nodejs.org/)
2. Download the latest LTS version (20.x or 22.x)
3. Install it (this will replace your current version)
4. Restart your terminal/IDE
5. Verify: `node --version` (should show 20.18.1 or higher)

#### Option 2: Using nvm (Node Version Manager)
```bash
# Install nvm if you don't have it
# Windows: Download from https://github.com/coreybutler/nvm-windows/releases

# Install Node 20.18.1
nvm install 20.18.1
nvm use 20.18.1

# Verify
node --version
```

#### Option 3: Using Chocolatey (Windows)
```bash
choco upgrade nodejs
```

### After Updating Node.js

1. **Reinstall dependencies**:
   ```bash
   npm install
   ```

2. **Restart dev server**:
   ```bash
   npm run dev
   ```

3. **Test the downloader** - it should now work!

### Why This is Necessary

YouTube frequently changes their page structure. The old library version (4.14.4) can't parse YouTube's current HTML, which causes the "parsing watch.html" error. The latest version (4.16.12) has fixes for this, but requires a newer Node.js version.

### Vercel Deployment

Vercel will automatically use Node.js 20.x (which includes 20.18.1+), so your deployment will work fine. The update is mainly needed for local development.

### Quick Check

After updating, run:
```bash
node --version
npm install
npm run dev
```

If you see Node.js 20.18.1 or higher, you're good to go!
