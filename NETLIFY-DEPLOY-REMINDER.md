# Netlify production deploy reminder

**Status:** Normal `netlify deploy --prod` is currently blocked because the Netlify account has exceeded its credit usage. The live site is currently published using the draft deploy API followed by `restore`, and that live deploy is verified working.

## Do this later

1. Confirm the Netlify account credits/plan are active again.
2. From `C:\All Coding Projects\sellmate`, run:

   ```powershell
   netlify deploy --prod
   ```

3. Verify `https://sellmate-draft.netlify.app` loads the latest files with:
   - no console errors
   - no failed network requests
   - the expected service worker cache name in `sw.js`
4. After a successful CLI deploy, update or delete this reminder.

## Do not do yet

Do not retry `netlify deploy --prod` while the credit block is active. It fails with:

> Account credit usage exceeded - new deploys are blocked until credits added

Until then, continue using the draft API + `restore` workflow.
