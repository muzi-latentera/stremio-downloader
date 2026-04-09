#!/usr/bin/env node

const server = require('./lib/server.js')
const download = require('./lib/download')
const platform = require('./lib/platform')

server(url => {
	const downloaderUrl = url + '/downloader/'
	console.log('Stremio Downloader running at: ' + downloaderUrl)
	console.log('Press Ctrl+C to stop')

	// Open browser to the downloader UI
	platform.openUrl(downloaderUrl)
})

function shutdown() {
	console.log('\nShutting down...')
	download.cleanEnd(() => {
		process.exit(0)
	})
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
