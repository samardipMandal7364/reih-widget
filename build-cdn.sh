#!/bin/bash
# Builds and assembles the CDN-ready folder for deployment.
# Output: cdn/ folder containing all files needed for iframe CDN hosting.

set -e

echo "Building production bundles..."
npm run build

echo "Assembling cdn/ folder..."
cp dist/reih-loader.js cdn/reih-loader.js
cp dist/reih-embed.js cdn/reih-embed.js

echo ""
echo "✓ CDN folder ready at: cdn/"
echo ""
echo "Files:"
ls -lh cdn/
echo ""
echo "Deploy the cdn/ folder to any static hosting:"
echo "  • Vercel:           cd cdn && vercel"
echo "  • Netlify:          drag cdn/ to netlify.com/drop"
echo "  • Cloudflare Pages: connect repo, set build output to cdn/"
echo "  • GitHub Pages:     push cdn/ contents to gh-pages branch"
echo "  • AWS S3:           aws s3 sync cdn/ s3://your-bucket/"
echo ""
echo "Then integrate on any website with:"
echo ""
echo '  <script>'
echo '    window.reihWidgetConfig = {'
echo "      tenantId: 'YOUR_TENANT_ID',"
echo "      embedBaseUrl: 'https://YOUR_CDN_DOMAIN'"
echo '    };'
echo '  </script>'
echo '  <script src="https://YOUR_CDN_DOMAIN/reih-loader.js" async></script>'
