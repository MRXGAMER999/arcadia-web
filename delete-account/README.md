# Delete Account / Data Request (GitHub Pages)

This page works on GitHub Pages and supports two submission paths:

- Primary: Formspree (reliable, no backend hosting)
- Fallback: `mailto:` (opens the user's email app)

## Recommended: Formspree (no backend)

Formspree hosts a form endpoint and emails submissions to you.

### 1) Create a Formspree form

1. Sign up at `https://formspree.io/`.
2. Create a new form.
3. Copy your endpoint URL, e.g. `https://formspree.io/f/abcdwxyz`.
4. Add your GitHub Pages domain to allowed origins if prompted.

### 2) Configure the endpoint in the page

Edit:

- `delete-account/index.html`

Find:

`const FORMSPREE_ENDPOINT = '';`

Replace it with your endpoint URL.

No repo secrets required.

### 3) Test

Open the page on GitHub Pages and submit the form. You should receive an email from Formspree.

## Alternative (no service): mailto:

If Formspree is not configured, the page will open the user's email app with a pre-filled deletion request.
