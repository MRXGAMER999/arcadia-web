# Arcadia Admin Dashboard

A comprehensive web-based admin dashboard to manage Beta Signups, Deletion Requests, and Feedback Submissions for the Arcadia app.

## Features

### 📊 Dashboard Overview
- Real-time statistics for all data collections
- Recent activity feed
- Quick navigation to all sections

### 👥 Beta Signups Management
- View all beta signup requests
- Filter by status (pending, accepted, rejected)
- Search by name or email
- Accept/reject signups directly
- Export to CSV

### 🗑️ Deletion Requests Management
- View all account/data deletion requests
- Filter by type (full or partial)
- Search by username or email
- Export to CSV

### 💬 Feedback Management
- View all user feedback and bug reports
- Filter by type (bug, feature, improvement, other)
- Filter by status (new, reviewed, resolved)
- View attached images
- Mark feedback as reviewed or resolved
- Star ratings display

## Setup

### 1. Deploy the Dashboard

The dashboard is a single HTML file that can be deployed anywhere:

**Option A: Static Hosting (Recommended)**
Upload `index.html` to any static hosting service:
- Netlify
- Vercel
- GitHub Pages
- Firebase Hosting
- AWS S3

**Option B: Local Usage**
Simply open `index.html` in your browser. Note: Some browsers may have CORS restrictions when opening files locally.

### 2. Configure Appwrite Permissions

Ensure your Appwrite API key has the following scopes:
- `documents.read` - Read all collection data
- `documents.write` - Update document status

### 3. Configure Collection IDs (Optional)

If your collection IDs differ from the defaults, edit the `COLLECTIONS` object in the JavaScript:

```javascript
const COLLECTIONS = {
    betaSignups: 'your_beta_signups_collection_id',
    deletionRequests: 'your_deletion_requests_collection_id',
    feedback: 'your_feedback_collection_id'
};
```

## Usage

### First Login

1. Open the dashboard URL
2. Enter your Appwrite credentials:
   - **Endpoint**: Your Appwrite endpoint (e.g., `https://cloud.appwrite.io/v1`)
   - **Project ID**: Your Appwrite project ID
   - **API Key**: Your Appwrite API key with appropriate scopes
   - **Database ID**: Your database ID

3. Click "Sign In"

Your credentials are stored locally in your browser for convenience. Use the Logout button to clear them.

### Managing Beta Signups

1. Click "Beta Signups" in the sidebar
2. Use the search box to find specific users
3. Use the status filter to show only pending/accepted/rejected
4. Click "Accept" or "Reject" to change status
5. Click "View" to see full details including IP and user agent
6. Click "Export CSV" to download all signups

### Managing Deletion Requests

1. Click "Deletion Requests" in the sidebar
2. Search by username or email
3. Filter by deletion type (full/partial)
4. Click "View" to see full details including notes
5. Click "Export CSV" to download all requests

### Managing Feedback

1. Click "Feedback" in the sidebar
2. Filter by type (bug, feature, improvement, other)
3. Filter by status (new, reviewed, resolved)
4. Click "View" to see:
   - Full message
   - Attached images (click to enlarge)
   - User information
5. Mark as "Reviewed" or "Resolved" as appropriate

## Keyboard Shortcuts

- `Escape` - Close modals
- `Ctrl + R` - Refresh data

## Security Notes

- Keep your API key secure and never commit it to version control
- Use an API key with minimal required permissions
- The dashboard stores credentials in localStorage for convenience - logout when using shared computers
- Consider adding authentication (like Cloudflare Access) when deploying to production

## Troubleshooting

### "Failed to connect to Appwrite"
- Verify your endpoint URL is correct
- Check that your API key has the required scopes
- Ensure your database ID is correct

### "Error loading data"
- Verify collection IDs match your Appwrite setup
- Check that collections exist and have documents
- Check browser console for detailed error messages

### Images not loading in feedback
- Verify the storage bucket ID in the feedback function matches your setup
- Ensure the API key has `files.read` scope

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Android)

## Customization

### Changing the Theme
Edit the CSS variables in the `<style>` section:

```css
:root {
    --primary: #6366f1;
    --primary-dark: #4f46e5;
    --success: #22c55e;
    --warning: #f59e0b;
    --danger: #ef4444;
    /* ... */
}
```

### Adding New Fields
To display additional fields from your collections:

1. Find the render function for the section (e.g., `renderBetaSignups`)
2. Add the new field to the table or detail view
3. Update the CSV export function if needed

## License

This dashboard is part of the Arcadia project and follows the same license terms.
