const fs = require('fs')
const path = require('path')
const platform = require('./platform')
const configDir = require('./userDir')

module.exports = {
	get: () => {
		const defaultDir = platform.getDefaultDownloadDir()

		const userSettingsPath = path.join(configDir, 'user-settings.json')

		let downloadFolder

		if (fs.existsSync(userSettingsPath)) {
			let fileData = fs.readFileSync(userSettingsPath, 'utf8')
			fileData = Buffer.isBuffer(fileData) ? fileData.toString() : fileData
			let obj
			try {
				obj = JSON.parse(fileData)
			} catch(e) {

			}

			if ((obj || {}).folder)
				downloadFolder = obj.folder
		}

		if (!downloadFolder)
			downloadFolder = defaultDir

		if (!fs.existsSync(downloadFolder))
			fs.mkdirSync(downloadFolder, { recursive: true })

		return downloadFolder
	},
	set: folder => {
		if (!folder) return
		const userSettingsPath = path.join(configDir, 'user-settings.json')
		fs.writeFileSync(userSettingsPath, JSON.stringify({ folder }))
	}
}
