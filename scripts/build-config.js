// Generates js/config.js from environment variables at Vercel build time.
// Set SUPABASE_URL and SUPABASE_ANON_KEY in your Vercel project settings.
const fs = require('fs');
const path = require('path');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_ANON_KEY must be set as environment variables.');
  console.error('Add them in Vercel: Project Settings -> Environment Variables');
  process.exit(1);
}

const content = `const SUPABASE_URL      = '${url}';\nconst SUPABASE_ANON_KEY = '${key}';\n`;
fs.writeFileSync(path.join(__dirname, '..', 'js', 'config.js'), content);
console.log('js/config.js generated from environment variables.');
