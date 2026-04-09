const download = require('./download')
const platform = require('./platform')
const events = require('./events')
const downloadDir = require('./downloadDir')
const tokenApi = require('./tokenDir')
const stremioDetect = require('./stremio-detect')
const addonConfig = require('./addon-config')

let endpoint

module.exports = {
	setEndpoint: str => {
		endpoint = str
	},
	router: (req, res) => {
		const parsedUrl = new URL(req.url, 'http://localhost')
		const query = Object.fromEntries(parsedUrl.searchParams.entries())
		if (query.method == 'add-download') {
			if (query.url) {
				let url = query.url
				if (url.startsWith('http://127.0.0.1:11470/')) {
					if (url.endsWith('/hls.m3u8'))
						url = url.replace('/hls.m3u8', '/')
				}
				download.get(query.title, url, query.streamId, filename => {
					if (filename) {
						res.statusCode = 200
						res.end(filename)
					} else {
						res.statusCode = 500
						res.end('error')
					}
				}, query.metaUrl, query.metaId, query.metaType)
			} else {
				res.statusCode = 500
		        res.end('error')
			}
		} else if (query.method == 'remove-download') {
			if (query.url && query.filename) {
				download.remove(query.filename, query.url)
				res.statusCode = 200
				res.end(JSON.stringify({ done: true }))
			} else {
				res.statusCode = 500
		        res.end('error')
			}
		} else if (query.method == 'load-stremio') {
			platform.openUrl(endpoint + '/web/app.strem.io/shell-v4.4/')
			res.statusCode = 200
			res.end(JSON.stringify({ done: true }))
		} else if (query.method == 'focus-window') {
			events.emit('focus-window')
			res.statusCode = 200
			res.end(JSON.stringify({ done: true }))
		} else if (query.method == 'open-folder') {

			const downDir = downloadDir.get()

			platform.openFile(downDir)

			res.statusCode = 200
			res.end(JSON.stringify({ done: true }))

		} else if (query.method == 'change-folder') {

			// In standalone mode, accept folder path via query parameter
			if (query.folder) {
				downloadDir.set(query.folder)
				res.statusCode = 200
				res.end(JSON.stringify({ done: true, folder: query.folder }))
			} else {
				res.statusCode = 200
				res.end(JSON.stringify({ done: true, currentFolder: downloadDir.get() }))
			}

		} else if (query.method == 'play-video') {
			if (query.url) {
				const file = download.find(query.url)

				platform.openFile(file.filePath)

				res.statusCode = 200
				res.end(JSON.stringify({ done: true }))
			} else {
				res.statusCode = 500
		        res.end('error')
			}
		} else if (query.method == 'open-location') {

			if (query.url) {
				const file = download.find(query.url)

				platform.showInFolder(file.filePath)

				res.statusCode = 200
				res.end(JSON.stringify({ done: true }))
			} else {
				res.statusCode = 500
		        res.end('error')
			}

		} else if (query.method == 'restart-download') {

			if (query.url) {
				const file = download.find(query.url)

				let name = file.filename.split('.')

				name.pop()

				name = name.join('.')

				download.get(name, file.url, file.streamId, () => {}, file.meta.url, file.meta.id, file.meta.type)

				res.statusCode = 200
				res.end(JSON.stringify({ done: true }))
			} else {
				res.statusCode = 500
		        res.end('error')
			}

		} else if (query.method == 'stop-download') {

			if (query.url && query.filename) {
				download.stop(query.filename, query.url)
				res.statusCode = 200
				res.end(JSON.stringify({ done: true }))
			} else {
				res.statusCode = 500
		        res.end('error')
			}

		} else if (query.method == 'install-addon') {
			const addonUrl = endpoint.replace('http:', 'stremio:') + '/addon-' + tokenApi.get() + '/manifest.json'
			platform.openUrl(addonUrl)
			res.statusCode = 200
			res.end(JSON.stringify({ done: true }))
		} else if (query.method == 'files') {
			res.statusCode = 200
			res.end(JSON.stringify(download.list()))
		} else if (query.method == 'get-folder') {
			res.statusCode = 200
			res.end(JSON.stringify({ folder: downloadDir.get() }))
		} else if (query.method == 'debug') {
			const token = tokenApi.get()
			const allFiles = download.list()
			const fs = require('fs')
			const downDir = downloadDir.get()
			let diskFiles = []
			try { diskFiles = fs.readdirSync(downDir) } catch(e) {}
			const debugInfo = {
				endpoint,
				token,
				downloadDir: downDir,
				filesEndpoint: endpoint + '/files-' + token,
				addonManifest: endpoint + '/addon-' + token + '/manifest.json',
				diskFiles,
				downloads: allFiles.map(f => ({
					filename: f.filename,
					streamId: f.streamId,
					metaId: (f.meta || {}).id,
					metaType: (f.meta || {}).type,
					finished: f.finished,
					error: f.error,
					progress: f.progress,
					streamUrl: endpoint + '/files-' + token + '/' + encodeURIComponent(f.filename)
				}))
			}
			res.statusCode = 200
			res.setHeader('Content-Type', 'application/json')
			res.end(JSON.stringify(debugInfo, null, 2))
		} else if (query.method == 'check-stremio') {
			const customPort = query.port ? parseInt(query.port) : null
			stremioDetect.detectStremioServer(customPort).then(result => {
				res.statusCode = 200
				res.end(JSON.stringify(result))
			}).catch(err => {
				res.statusCode = 500
				res.end(JSON.stringify({ found: false, error: err.message }))
			})
			return
		} else if (query.method == 'start-stremio') {
			stremioDetect.tryStartStremioServer(result => {
				res.statusCode = 200
				res.end(JSON.stringify(result))
			})
			return
		} else if (query.method == 'addon-sources') {
			res.statusCode = 200
			res.setHeader('Content-Type', 'application/json')
			res.end(JSON.stringify({ sources: addonConfig.getSources() }))
		} else if (query.method == 'add-addon-source') {
			if (query.name && query.url) {
				const sources = addonConfig.addSource(query.name, query.url)
				res.statusCode = 200
				res.end(JSON.stringify({ sources }))
			} else {
				res.statusCode = 400
				res.end(JSON.stringify({ error: 'name and url required' }))
			}
		} else if (query.method == 'remove-addon-source') {
			if (query.url) {
				const sources = addonConfig.removeSource(query.url)
				res.statusCode = 200
				res.end(JSON.stringify({ sources }))
			} else {
				res.statusCode = 400
				res.end(JSON.stringify({ error: 'url required' }))
			}
		} else {
			res.statusCode = 500
	        res.end('error')
		}
	}
}
