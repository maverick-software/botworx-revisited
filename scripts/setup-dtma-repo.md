# Setting Up a GitHub Repository for DTMA

This guide will help you set up a GitHub repository specifically for the Droplet Tool Management Agent (DTMA) code.

## Step 1: Create a New GitHub Repository

1. Go to GitHub and create a new repository:
   - Name: `agentopia-dtma`
   - Description: "Droplet Tool Management Agent for Agentopia"
   - Make it public (or private if you have security concerns)
   - Initialize with a README

2. Clone the repository to your local machine:
   ```bash
   git clone https://github.com/your-username/agentopia-dtma.git
   cd agentopia-dtma
   ```

## Step 2: Copy DTMA Code to the Repository

1. Copy the DTMA code from your main project into the new repository:
   ```bash
   # From the agentopia-dtma directory
   cp -r /path/to/your/agentopia/dtma/* .
   ```

2. Add, commit, and push the code:
   ```bash
   git add .
   git commit -m "Initial commit of DTMA code"
   git push origin main
   ```

## Step 3: Update Environment Configuration

1. Update your `.env` file with the new repository URL:
   ```
   DTMA_GIT_REPO_URL=https://github.com/your-username/agentopia-dtma.git
   DTMA_GIT_BRANCH=main
   ```

## Step 4: Verify Repository Access

1. Make sure the repository is accessible from the public internet (or has appropriate access controls if private)
2. Test cloning the repository from another machine to verify access

## Optional: Set Up GitHub Actions for CI/CD

1. Create a `.github/workflows` directory
2. Add a basic workflow file for testing:
   ```yaml
   name: DTMA CI

   on:
     push:
       branches: [ main ]
     pull_request:
       branches: [ main ]

   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
       - uses: actions/checkout@v2
       - name: Use Node.js
         uses: actions/setup-node@v2
         with:
           node-version: '16.x'
       - run: npm ci
       - run: npm run build --if-present
       - run: npm test --if-present
   ```

## Maintaining the Repository

- When you make changes to the DTMA code in your main project, be sure to update the dedicated repository as well
- Consider automating this process with a script if you expect frequent changes

## Alternative Approach: Packaging DTMA Code

If creating a separate repository isn't desirable, you could:

1. Package the DTMA code as a tar/zip file
2. Upload it to a cloud storage service (S3, Google Cloud Storage)
3. Modify the bootstrap script to download and extract this package instead of git cloning

Example bootstrap script modification:
```bash
# Instead of git clone
curl -L https://your-storage-url.com/dtma-latest.tar.gz | tar xz -C /opt/agentopia/
```

This would require updating the package whenever the DTMA code changes. 