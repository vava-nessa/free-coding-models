---
name: verify-website
description: Verify the production website freecodingmodels.vercel.app is up, routes work, key content is present, and build is healthy. Run after each deployment.
---

# Website Production Verification

Verify **https://freecodingmodels.vercel.app** is live and correct after a deployment.

## Steps

### 1. Check key routes return 200

```bash
for path in "/" "/blog" "/docs" "/providers" "/models" "/changelog"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://freecodingmodels.vercel.app$path")
  echo "$code $path"
done
```

Expected: all return `200`.

### 2. Check critical content is present on the homepage

```bash
content=$(curl -s "https://freecodingmodels.vercel.app")
echo "$content" | grep -q "free-coding-models" && echo "✅ wordmark found" || echo "❌ wordmark missing"
echo "$content" | grep -q "Find the fastest" && echo "✅ subtitle found" || echo "❌ subtitle missing"
echo "$content" | grep -q "npm install" && echo "✅ install command found" || echo "❌ install command missing"
```

### 3. Check static assets load

```bash
# Check that the JS bundle URL from index.html is reachable
asset=$(curl -s "https://freecodingmodels.vercel.app" | grep -o '/assets/index-[^"]*\.js' | head -1)
if [ -n "$asset" ]; then
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://freecodingmodels.vercel.app$asset")
  echo "$code /assets/... (JS bundle)"
else
  echo "⚠️  Could not parse asset URL from HTML"
fi
```

### 4. Check Open Graph meta tags

```bash
curl -s "https://freecodingmodels.vercel.app" | grep -E 'og:(title|description|type)|twitter:card'
```

### 5. Check response time

```bash
curl -s -o /dev/null -w "Total: %{time_total}s  TTFB: %{time_starttransfer}s\n" \
  "https://freecodingmodels.vercel.app"
```

Target: Total < 2s, TTFB < 0.5s.

### 6. Check vercel.json is correct (local sanity)

```bash
cat website/vercel.json
# Expected: outputDirectory=dist, rewrite /* -> /index.html
```

### 7. Quick Lighthouse score (if @lhci/cli is available)

```bash
if command -v lhci &>/dev/null; then
  lhci collect --url=https://freecodingmodels.vercel.app --numberOfRuns=1 2>&1 | tail -5
  lhci assert --preset=lighthouse:recommended 2>&1 | tail -10
else
  echo "ℹ️  Install @lhci/cli globally to run Lighthouse: npm i -g @lhci/cli"
fi
```

## Expected results

| Check | Expected |
|-------|----------|
| All key routes | `200` |
| Wordmark in HTML | ✅ |
| Subtitle in HTML | ✅ |
| JS bundle accessible | `200` |
| OG tags present | At least `og:title`, `og:description` |
| Total response time | < 2s |
| Lighthouse perf | > 80 |

## If something fails

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| 404 on all routes | Vercel `outputDirectory` wrong | Check `website/vercel.json` — must be `dist` |
| Blank page | JS bundle not loading or build failed | Run `pnpm build` in `website/`, check `dist/index.html` exists |
| Missing content | Old deployment cached | Hard refresh or purge Vercel CDN |
| Slow TTFB | First cold start | Retry — Vercel CDN warms up after first hit |
| 200 but wrong content | SPA rewrite sending wrong index.html | Check `vercel.json` rewrites |

## Run after each push to main

This skill should be invoked after any `git push origin main` that touches `website/`.
