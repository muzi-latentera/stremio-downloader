
function request(method, url, filename, cb) {
	cb = cb || (() => {})
	const params = new URLSearchParams()
	params.set('method', method)
	if (url) params.set('url', url)
	if (filename) params.set('filename', filename)
	fetch('/api?' + params.toString())
		.then(resp => resp.text())
		.then(data => cb(data))
		.catch(() => cb(null))
}

function fileToRow(file, idx) {
	let str = '' +
	'<tr>' +
		'<td class="name">' + escapeHtml(file.filename) + '</td>' +
		'<td class="desc">' + (file.error ? 'Error' : file.finished ? 'Finished' : file.stopped ? 'Stopped' : file.isHls ? 'Downloading' : file.progress + '%')+'</td>' +
		'<td class="actions">'

	const encodedUrl = encodeURIComponent(file.url)
	const encodedFilename = encodeURIComponent(file.filename)

	str += '' +
		'<button class="btn btn-icon" onclick="apiCall(\'remove-download\', \'' + encodedUrl + '\', \'' + encodedFilename + '\')" title="Delete">' +
			'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>' +
		'</button>'

	if (file.error || file.stopped) {
		str += '' +
			'<button class="btn btn-icon" onclick="apiCall(\'restart-download\', \'' + encodedUrl + '\', \'' + encodedFilename + '\')" title="Restart">' +
				'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>' +
			'</button>'
	} else if (file.finished) {
		str += '' +
			'<button class="btn btn-icon" onclick="fileOptions(\'' + encodedUrl + '\', \'' + encodedFilename + '\')" title="Options">' +
				'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>' +
			'</button>'
	} else {
		str += '' +
			'<button class="btn btn-icon" onclick="apiCall(\'stop-download\', \'' + encodedUrl + '\', \'' + encodedFilename + '\')" title="Stop">' +
				'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12"/></svg>' +
			'</button>'
	}

	str += '' +
		'</td>' +
	'</tr>'

	return str
}

function escapeHtml(str) {
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function options() {
	const dialog = document.getElementById('dialog')
	dialog.innerHTML = '<div class="dialog-content">' +
		'<h3>Options</h3>' +
		'<button class="btn btn-full" onclick="apiCall(\'open-folder\')">Open Download Folder</button>' +
		'<button class="btn btn-full" onclick="showFolderInput()">Change Download Folder</button>' +
		'<button class="btn btn-full" onclick="apiCall(\'install-addon\')">Install Downloader as Add-on</button>' +
		'<button class="btn btn-full" onclick="showAddonSources()">Manage Stream Sources</button>' +
		'<button class="btn btn-full" onclick="showDebug()">Debug Info</button>' +
		'<div id="folder-input-area"></div>' +
		'<button class="btn btn-full btn-secondary" onclick="closeDialog()">Close</button>' +
	'</div>'
	dialog.showModal()
}

function showFolderInput() {
	fetch('/api?method=get-folder')
		.then(r => r.json())
		.then(data => {
			document.getElementById('folder-input-area').innerHTML =
				'<div class="folder-input">' +
					'<input type="text" id="folder-path" value="' + escapeHtml(data.folder) + '" placeholder="/path/to/downloads">' +
					'<button class="btn" onclick="saveFolder()">Save</button>' +
				'</div>'
		})
}

function showAddonSources() {
	fetch('/api?method=addon-sources')
		.then(r => r.json())
		.then(data => {
			let html = '<div style="text-align:left;margin-top:12px">' +
				'<h4 style="margin-bottom:8px">Stream Sources</h4>' +
				'<p style="font-size:12px;color:#999;margin-bottom:8px">These addons are queried for download options. Add your Torrentio/Comet URLs here.</p>'

			if (data.sources && data.sources.length) {
				data.sources.forEach(s => {
					html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
						'<span style="flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(s.name) + ': ' + escapeHtml(s.url.substring(0, 40)) + '...</span>' +
						'<button class="btn btn-small" onclick="removeAddonSource(\'' + escapeHtml(s.url) + '\')">Remove</button>' +
						'</div>'
				})
			} else {
				html += '<p style="color:#ff9800;font-size:13px">No sources configured. Add one below.</p>'
			}

			html += '<div style="margin-top:12px">' +
				'<input type="text" id="source-name" placeholder="Name (e.g. Torrentio)" style="width:100%;margin-bottom:6px;padding:6px;background:#16213e;border:1px solid #333;border-radius:4px;color:#e0e0e0;font-size:13px">' +
				'<input type="text" id="source-url" placeholder="Addon URL (e.g. https://torrentio.strem.fun)" style="width:100%;margin-bottom:6px;padding:6px;background:#16213e;border:1px solid #333;border-radius:4px;color:#e0e0e0;font-size:13px">' +
				'<button class="btn btn-full" onclick="addAddonSource()">Add Source</button>' +
				'</div></div>'

			document.getElementById('folder-input-area').innerHTML = html
		})
}

function addAddonSource() {
	const name = document.getElementById('source-name').value
	const url = document.getElementById('source-url').value
	if (name && url) {
		fetch('/api?method=add-addon-source&name=' + encodeURIComponent(name) + '&url=' + encodeURIComponent(url))
			.then(r => r.json())
			.then(() => showAddonSources())
	}
}

function removeAddonSource(url) {
	fetch('/api?method=remove-addon-source&url=' + encodeURIComponent(url))
		.then(r => r.json())
		.then(() => showAddonSources())
}

function showDebug() {
	fetch('/api?method=debug')
		.then(r => r.json())
		.then(data => {
			document.getElementById('folder-input-area').innerHTML =
				'<pre style="text-align:left;font-size:11px;max-height:300px;overflow:auto;background:#111;padding:8px;border-radius:6px;white-space:pre-wrap;word-break:break-all">' +
				escapeHtml(JSON.stringify(data, null, 2)) +
				'</pre>'
		})
}

function saveFolder() {
	const folder = document.getElementById('folder-path').value
	if (folder) {
		fetch('/api?method=change-folder&folder=' + encodeURIComponent(folder))
			.then(r => r.json())
			.then(() => {
				document.getElementById('folder-input-area').innerHTML =
					'<div class="status-msg success">Folder updated!</div>'
			})
	}
}

function fileOptions(url, filename) {
	const dialog = document.getElementById('dialog')
	dialog.innerHTML = '<div class="dialog-content">' +
		'<h3>File Options</h3>' +
		'<button class="btn btn-full" onclick="apiCall(\'open-location\',\'' + url + '\', \'' + filename + '\')">Open File Location</button>' +
		'<button class="btn btn-full" onclick="apiCall(\'play-video\',\'' + url + '\', \'' + filename + '\')">Play Video</button>' +
		'<button class="btn btn-full btn-secondary" onclick="closeDialog()">Close</button>' +
	'</div>'
	dialog.showModal()
}

function search(cb) {
	setTimeout(() => {
		const query = document.getElementById('query').value
		const results = []
		let files
		try {
			files = JSON.parse(localFiles)
		} catch(e) {
			files = []
		}
		files.forEach(el => {
			if (includes(el.filename, query))
				results.push(el)
		})
		if (results.length) {
			let str = ''
			results.forEach((el, ij) => {
				str += fileToRow(el, ij)
			})
			document.getElementById('downloads').innerHTML = str
		} else
			document.getElementById('downloads').innerHTML = ''
		if (cb) cb()
	})
}

let localFiles = '[]'

function includes(str, str2) {
	return str.split('.').join(' ').toLowerCase().includes(str2.toLowerCase())
}

document.addEventListener('DOMContentLoaded', () => {

	const dialog = document.getElementById('dialog')

	document.getElementById('query').addEventListener('keydown', evt => {
		evt = evt || window.event
		if (evt.keyCode === 13) {
			evt.preventDefault()
			return false
		}
		search()
	})

	function update() {
		request('files', null, null, files => {
			if (!files) {
				setTimeout(update, 2000)
				return
			}
			if (localFiles == files) {
				if (localFiles == '[]')
					document.getElementById('no-downloads').style.display = 'block'
				setTimeout(update, 2000)
				return
			}

			localFiles = files

			try { files = JSON.parse(files) } catch(e) { files = [] }

			let str = ''

			const query = document.getElementById('query').value

			if ((query || '').length)
				files = files.filter(el => includes(el.filename, query))

			files.forEach((el, idx) => { str += fileToRow(el, idx) })

			if (!files.length) {
				document.getElementById('no-downloads').style.display = 'block'
				document.getElementById('downloads').innerHTML = ''
			} else {
				document.getElementById('no-downloads').style.display = 'none'
				document.getElementById('downloads').innerHTML = str
			}

			setTimeout(update, 2000)
		})
	}

	update()

	function checkEngine() {
		fetch('/api?method=check-stremio')
			.then(r => r.json())
			.then(data => {
				const el = document.getElementById('no-engine')
				const statusEl = document.getElementById('stremio-status')
				if (data.found) {
					el.style.display = 'none'
					if (statusEl) {
						statusEl.className = 'status-indicator connected'
						statusEl.textContent = 'Stremio server: connected (' + data.url + ')'
					}
				} else {
					el.style.display = 'block'
					if (statusEl) {
						statusEl.className = 'status-indicator disconnected'
						statusEl.textContent = 'Stremio server: not found'
					}
					if (data.suggestions) {
						el.innerHTML = '<strong>Stremio streaming server not detected</strong><br>' +
							'<small>' + data.suggestions.join('<br>') + '</small>' +
							'<br><button class="btn btn-small" onclick="checkEngine()" style="margin-top:8px">Retry</button>' +
							'<button class="btn btn-small" onclick="tryStartStremio()" style="margin-top:8px;margin-left:8px">Try Start Stremio</button>'
					}
				}
			})
			.catch(() => {
				const el = document.getElementById('no-engine')
				el.style.display = 'block'
			})

		setTimeout(checkEngine, 10000)
	}

	// Expose for the retry button
	window.checkEngine = checkEngine

	checkEngine()
})

function tryStartStremio() {
	const el = document.getElementById('no-engine')
	el.innerHTML = '<strong>Attempting to start Stremio...</strong>'
	fetch('/api?method=start-stremio')
		.then(r => r.json())
		.then(data => {
			if (data.started) {
				el.style.display = 'none'
			} else {
				el.innerHTML = '<strong>Could not start Stremio automatically</strong><br>' +
					'<small>Please start Stremio manually, then click Retry</small>' +
					'<br><button class="btn btn-small" onclick="checkEngine()" style="margin-top:8px">Retry</button>'
			}
		})
		.catch(() => {
			el.innerHTML = '<strong>Error starting Stremio</strong><br>' +
				'<button class="btn btn-small" onclick="checkEngine()" style="margin-top:8px">Retry</button>'
		})
}

function apiCall(method, url, filename) {
	if (filename) filename = decodeURIComponent(filename)
	if (url) url = decodeURIComponent(url)
	request(method, url, filename)
	closeDialog()
}

function closeDialog() {
	const dialog = document.getElementById('dialog')
	if (dialog.open) dialog.close()
}
