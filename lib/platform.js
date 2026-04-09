const os = require('os')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

function getConfigDir() {
	const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config')
	const configDir = path.join(xdgConfig, 'stremio-downloader')
	if (!fs.existsSync(configDir))
		fs.mkdirSync(configDir, { recursive: true })
	return configDir
}

function getTempDir() {
	const tempDir = path.join(os.tmpdir(), 'StremioDownloader')
	if (!fs.existsSync(tempDir))
		fs.mkdirSync(tempDir, { recursive: true })
	return tempDir
}

function getDefaultDownloadDir() {
	const dlDir = path.join(os.homedir(), 'Downloads', 'StremioDownloader')
	if (!fs.existsSync(dlDir))
		fs.mkdirSync(dlDir, { recursive: true })
	return dlDir
}

function openFile(filePath) {
	if (process.platform === 'darwin') {
		spawn('open', [filePath], { stdio: 'ignore', detached: true }).unref()
	} else if (process.platform === 'win32') {
		spawn('cmd', ['/c', 'start', '', filePath], { stdio: 'ignore', detached: true }).unref()
	} else {
		spawn('xdg-open', [filePath], { stdio: 'ignore', detached: true }).unref()
	}
}

function openUrl(url) {
	if (process.platform === 'darwin') {
		spawn('open', [url], { stdio: 'ignore', detached: true }).unref()
	} else if (process.platform === 'win32') {
		spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true }).unref()
	} else {
		spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref()
	}
}

function showInFolder(filePath) {
	const dir = path.dirname(filePath)
	openFile(dir)
}

module.exports = {
	getConfigDir,
	getTempDir,
	getDefaultDownloadDir,
	openFile,
	openUrl,
	showInFolder
}
