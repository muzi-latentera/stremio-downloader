const http = require('http')
const { exec } = require('child_process')

const DEFAULT_PORT = 11470
const SCAN_PORTS = [11470, 11471, 11472, 11473, 11474, 11475]

function probePort(port, timeout) {
	timeout = timeout || 3000
	return new Promise(resolve => {
		const req = http.get({
			hostname: '127.0.0.1',
			port: port,
			path: '/settings',
			timeout: timeout
		}, res => {
			let body = ''
			res.on('data', chunk => { body += chunk })
			res.on('end', () => {
				resolve({ found: true, port, url: 'http://127.0.0.1:' + port })
			})
		})
		req.on('error', () => resolve({ found: false, port }))
		req.on('timeout', () => {
			req.destroy()
			resolve({ found: false, port })
		})
	})
}

async function detectStremioServer(customPort) {
	// Try custom port first if provided
	if (customPort) {
		const result = await probePort(customPort)
		if (result.found) return result
	}

	// Try default port
	const defaultResult = await probePort(DEFAULT_PORT)
	if (defaultResult.found) return defaultResult

	// Scan fallback ports in parallel
	const results = await Promise.all(
		SCAN_PORTS.filter(p => p !== DEFAULT_PORT).map(p => probePort(p, 2000))
	)
	const found = results.find(r => r.found)
	if (found) return found

	return {
		found: false,
		error: 'Stremio streaming server not detected',
		suggestions: [
			'Make sure Stremio is running',
			'The streaming server should be at http://127.0.0.1:11470',
			'If using Flatpak: flatpak run com.stremio.Stremio',
			'You can also run the server directly: node ~/.stremio-server/server.js'
		]
	}
}

function tryStartStremioServer(cb) {
	// Try common Stremio locations on Linux
	const commands = [
		'flatpak run com.stremio.Stremio &',
		'stremio &'
	]

	let tried = 0
	function tryNext() {
		if (tried >= commands.length) {
			cb({ started: false, error: 'Could not start Stremio automatically' })
			return
		}
		exec(commands[tried], (err) => {
			if (!err) {
				// Wait a moment for the server to start
				setTimeout(() => {
					probePort(DEFAULT_PORT).then(result => {
						if (result.found) {
							cb({ started: true, url: result.url })
						} else {
							tried++
							tryNext()
						}
					})
				}, 3000)
			} else {
				tried++
				tryNext()
			}
		})
	}
	tryNext()
}

module.exports = {
	detectStremioServer,
	tryStartStremioServer,
	probePort
}
