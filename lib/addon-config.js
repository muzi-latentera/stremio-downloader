const fs = require('fs')
const path = require('path')
const configDir = require('./userDir')

const configPath = path.join(configDir, 'addon-sources.json')

const DEFAULT_SOURCES = [
	{ name: 'Torrentio', url: 'https://torrentio.strem.fun' }
]

function getSources() {
	if (fs.existsSync(configPath)) {
		try {
			const data = JSON.parse(fs.readFileSync(configPath, 'utf8'))
			if (Array.isArray(data.sources) && data.sources.length > 0)
				return data.sources
		} catch(e) {}
	}
	return DEFAULT_SOURCES
}

function setSources(sources) {
	fs.writeFileSync(configPath, JSON.stringify({ sources }, null, 2))
}

function addSource(name, url) {
	const sources = getSources()
	// Remove trailing slash
	url = url.replace(/\/+$/, '')
	// Don't add duplicates
	if (sources.some(s => s.url === url)) return sources
	sources.push({ name, url })
	setSources(sources)
	return sources
}

function removeSource(url) {
	let sources = getSources()
	sources = sources.filter(s => s.url !== url)
	setSources(sources)
	return sources
}

function isConfigured() {
	return fs.existsSync(configPath)
}

module.exports = {
	getSources,
	setSources,
	addSource,
	removeSource,
	isConfigured
}
