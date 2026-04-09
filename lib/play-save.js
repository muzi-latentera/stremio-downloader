const http = require('follow-redirects').http
const https = require('follow-redirects').https
const download = require('./download')
const metaDir = require('./metaDir')

// Endpoint that triggers a background download and shows a confirmation page
function playSave(req, res) {
	const parsedUrl = new URL(req.url, 'http://localhost')
	const sourceUrl = parsedUrl.searchParams.get('url')
	const title = parsedUrl.searchParams.get('title') || 'Unknown'
	const streamId = parsedUrl.searchParams.get('streamId') || ''
	const metaId = parsedUrl.searchParams.get('metaId') || ''
	const metaType = parsedUrl.searchParams.get('metaType') || ''
	const metaUrl = parsedUrl.searchParams.get('metaUrl') || ''

	if (!sourceUrl) {
		res.writeHead(400, { 'Content-Type': 'text/html' })
		res.end('<html><body>Missing url</body></html>')
		return
	}

	let decodedTitle = title
	try { decodedTitle = decodeURIComponent(title) } catch(e) {}

	// Start the download in the background using the existing download system
	download.get(decodedTitle, sourceUrl, streamId, (filename) => {
		// Download started (or failed) — already handled by download module
		if (filename) {
			console.log('Download started: ' + filename)
		} else {
			console.log('Download failed to start for: ' + decodedTitle)
		}
	}, metaUrl, metaId, metaType)

	// Return a simple confirmation page that auto-closes
	res.writeHead(200, { 'Content-Type': 'text/html' })
	res.end(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Download Started</title>
<style>
body { background: #1a1a2e; color: #e0e0e0; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
.card { text-align: center; padding: 40px; background: #16213e; border-radius: 16px; max-width: 400px; }
h2 { color: #5c6bc0; margin-bottom: 8px; }
p { color: #9e9e9e; font-size: 14px; }
.title { color: #e0e0e0; font-size: 16px; margin: 16px 0; }
</style>
</head>
<body>
<div class="card">
<h2>Download Started</h2>
<div class="title">${decodedTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
<p>You can close this tab and go back to Stremio.</p>
<p>Check progress in the "Downloaded" catalog.</p>
<p style="color:#555;font-size:12px;margin-top:20px">This tab will close in 3 seconds...</p>
</div>
<script>setTimeout(function(){ window.close(); }, 3000);</script>
</body>
</html>`)
}

module.exports = playSave
