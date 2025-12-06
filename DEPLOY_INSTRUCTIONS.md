# 🚀 Deploy to GitHub Pages - Quick Start

## Current Status
- ✅ Git repository initialized
- ✅ All files committed
- ⚠️ Need to push to YOUR GitHub account

## Steps to Deploy:

### 1️⃣ Create GitHub Repository
1. Go to: https://github.com/new
2. Repository name: `camera-rental-system`
3. Make it **Public** ✅
4. **Do NOT** check "Add README" or any initialization options
5. Click "Create repository"

### 2️⃣ Update Remote URL
After creating the repo, run this command (replace YOUR-USERNAME with `Wajahat147` or your username):

```bash
git remote set-url origin https://github.com/YOUR-USERNAME/camera-rental-system.git
```

### 3️⃣ Push Your Code
```bash
git push -u origin main
```

**Note:** You may need a Personal Access Token (PAT) instead of password:
- Create one at: https://github.com/settings/tokens
- Select scope: `repo` (full control of private repositories)
- Use the token as your password when prompted

### 4️⃣ Enable GitHub Pages
1. Go to your repository on GitHub
2. Click **Settings** tab
3. Click **Pages** in left sidebar
4. Under "Source": Select **main** branch and **/ (root)** folder
5. Click **Save**

### 5️⃣ Access Your Site
After 1-2 minutes, your site will be live at:
```
https://YOUR-USERNAME.github.io/camera-rental-system/
```

## ⚙️ Configure Supabase for GitHub Pages

**Important:** After deployment, update your Supabase project:

1. Go to your Supabase Dashboard
2. Navigate to: **Authentication** → **URL Configuration**
3. Add your GitHub Pages URL:
   - Site URL: `https://YOUR-USERNAME.github.io/camera-rental-system/`
   - Redirect URLs: Add the same URL

This ensures authentication works correctly on GitHub Pages.

## 🔍 Verify Deployment

Check these items after deployment:
- [ ] Homepage loads with styling
- [ ] Navigation works
- [ ] Seller login page accessible
- [ ] Buyer login page accessible
- [ ] Buyer dashboard shows cameras
- [ ] No console errors (F12 → Console)

## 🆘 Need Help?

If you encounter issues:
1. Check browser console (F12) for errors
2. Verify all file paths are relative (no leading `/`)
3. Ensure Supabase URL configuration includes your GitHub Pages domain
4. Wait a few minutes if you get 404 - GitHub Pages takes time to deploy

---

**Ready to deploy?** Follow the steps above, and your Camera Rental System will be live! 🎉
