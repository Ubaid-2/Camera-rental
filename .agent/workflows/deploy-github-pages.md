---
description: Deploy Camera Rental System to GitHub Pages
---

# Deploy to GitHub Pages

Follow these steps to deploy your Camera Rental System to GitHub Pages:

## Step 1: Create a New GitHub Repository

1. Go to [GitHub](https://github.com) and log in
2. Click the "+" icon in the top right corner
3. Select "New repository"
4. Name it `camera-rental-system` (or any name you prefer)
5. Make it **Public** (required for free GitHub Pages)
6. Do NOT initialize with README, .gitignore, or license (we already have these)
7. Click "Create repository"

## Step 2: Update Remote URL

After creating the repository, GitHub will show you the repository URL. Run this command with YOUR username:

```bash
git remote set-url origin https://github.com/YOUR-USERNAME/camera-rental-system.git
```

Replace `YOUR-USERNAME` with your actual GitHub username (Wajahat147).

## Step 3: Push Your Code

```bash
git push -u origin main
```

If prompted, enter your GitHub credentials. You may need to use a Personal Access Token instead of your password.

### Creating a Personal Access Token (if needed):

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name like "Camera Rental Deploy"
4. Select scopes: `repo` (all repo permissions)
5. Click "Generate token"
6. Copy the token and use it as your password when pushing

## Step 4: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click "Settings" tab
3. Scroll down to "Pages" in the left sidebar
4. Under "Source", select "Deploy from a branch"
5. Under "Branch", select `main` and `/ (root)`
6. Click "Save"

## Step 5: Wait for Deployment

GitHub will automatically deploy your site. This usually takes 1-2 minutes.

Your site will be available at:
```
https://YOUR-USERNAME.github.io/camera-rental-system/
```

## Step 6: Verify Deployment

Once deployed, visit your site URL and verify:
- ✅ The homepage loads correctly
- ✅ CSS styling is applied
- ✅ Navigation works
- ✅ Login pages are accessible
- ✅ Supabase connection works (check browser console for errors)

## Important Notes:

⚠️ **Supabase Configuration**: Make sure your Supabase project allows requests from your GitHub Pages domain:
1. Go to your Supabase project dashboard
2. Navigate to Authentication → URL Configuration
3. Add your GitHub Pages URL to the "Site URL" and "Redirect URLs"

⚠️ **Security**: Your `config.js` file contains Supabase credentials. For GitHub Pages (public repo), this is okay for the anonymous key (public key), but never commit service role keys or secrets.

## Troubleshooting:

**404 Error**: Wait a few minutes after enabling Pages, or check that you selected the correct branch.

**CSS Not Loading**: Check that all file paths in your HTML are relative (no leading `/`).

**Supabase Errors**: Check browser console and verify your Supabase URL configuration includes your GitHub Pages domain.
