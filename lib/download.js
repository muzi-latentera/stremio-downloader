const http = require('follow-redirects').http
const https = require('follow-redirects').https
const mime = require('mime-types')
const fs = require('fs')
const path = require('path')
const downloadDir = require('./downloadDir')
const filelist = require('./fileList')
const metaDir = require('./metaDir')
const ffmpeg = require('fluent-ffmpeg')
const files = filelist.get()
const isWin = process.platform === 'win32'
files.forEach((el, ij) => {
    if (!el.error && (!el.finished || !el.filePath || !fs.existsSync(el.filePath)))
        files[ij].error = true
})
filelist.set(files)
function saveFiles() {
    saveFilesTimer = null
    const waitFor = filelist.set(files)
    saveFilesTimer = setTimeout(saveFiles, 60 * 60 * 1000)
}
// no need to save on app start
let saveFilesTimer = setTimeout(saveFiles, 60 * 60 * 1000)
function clone(obj) { return JSON.parse(JSON.stringify(obj)) }
function checkFilePath(origPath, filePath, nr) {
    filePath = filePath || origPath
    nr = nr || 0
    if (fs.existsSync(filePath)) {
        const parts = origPath.split('.')
        nr++
        parts[parts.length -2] = parts[parts.length -2] + ' (' + nr + ')'
        const newFilePath = parts.join('.')
        return checkFilePath(origPath, newFilePath, nr)
    }
    return filePath
}
function removeIllegalCharacters(name) {

    if (!name)
        return false

    if (isWin) {
        // illegal characters on windows are: < > : " / \ | ? *
        return name.replace(/\<|\>|\:|\"|\/|\\|\||\?|\*/g,' ').replace(/  +/g, ' ')
    } else {
        // illegal characters on Linux / OSX are: /
        return name.split('/').join(' ').replace(/  +/g, ' ')
    }

}
function decideFilename(name, url, contentType) {
    let isHls = false
    if (contentType && hlsTypes.includes(contentType.toLowerCase()))
        isHls = true
    const ext = isHls ? 'mp4' : mime.extension(contentType)
    if (name && ext)
        return name + '.' + ext
    let filename = url.split('/').pop()
    if ((filename || '').includes('?'))
        filename = filename.split('?')[0]
    try { filename = decodeURIComponent(filename) } catch(e) {}
    if (!filename || filename.length < 4 || !filename.includes('.') || isHls) {
        if (contentType) {
            if (name)
                return name + '.' + ext
            else
                return 'Unknown.' + ext
        } else
            return false
    } else
        return filename
}
const hlsTypes = [
    'video/m3u',
    'video/m3u8',
    'video/hls',
    'application/x-mpegurl',
    'vnd.apple.mpegURL',
    'video/mp2t',
    'application/vnd.apple.mpegurl'
]

function httpGet(url) {
    return url.startsWith('https') ? https : http
}

function getMeta(url, metaUrl, metaId, metaType) {
    const client = httpGet(metaUrl)
    client.get(metaUrl, (resp) => {
        let body = ''
        resp.on('data', chunk => { body += chunk })
        resp.on('end', () => {
            if (body)
                metaDir.setMeta(metaId, metaType, body)
        })
    }).on('error', () => {})
}

function headRequest(url, callback) {
    let parsedUrl
    try {
        parsedUrl = new URL(url)
    } catch(e) {
        callback(new Error('Invalid URL: ' + url), null)
        return
    }
    const client = url.startsWith('https') ? https : http
    const options = {
        method: 'HEAD',
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        headers: {
            'User-Agent': 'StremioDownloader/2.0'
        }
    }
    const req = client.request(options, res => {
        callback(null, res)
    })
    req.on('error', err => {
        callback(err, null)
    })
    req.end()
}

const download = {
    list: () => {
        return clone(files).map(file => {
            file.progress = Math.floor((file.current/file.total) * 100)
            delete file.current
            return file
        }).reverse()
    },
    get: (name, url, streamId, filenameCb, metaUrl, metaId, metaType) => {
        // Decode URL-encoded names (e.g. %20 -> space, %5B -> [)
        if (name) {
            try { name = decodeURIComponent(name) } catch(e) {}
        }
        headRequest(url, function(err, res){
            if (err || !(res || {}).headers) {
                filenameCb(false)
                return
            }
            const total = res.headers['content-length']
            const type = res.headers['content-type']
            files.some((el, ij) => {
                if (el.url == url) {
                    const waitFor = download.remove(null, url)
                    return true
                }
            })
            const filename = removeIllegalCharacters(decideFilename(name, url, type))
            if (!filename) {
                filenameCb(false)
                return
            }
            filenameCb(filename)
            const downDir = downloadDir.get()
            let filePath = path.join(downDir, filename)
            filePath = checkFilePath(filePath)
            if (type && hlsTypes.includes(type.toLowerCase())) {
                // ffmpeg -i "http://example.com/video_url.m3u8" -c copy -bsf:a aac_adtstoasc "output.mp4"
                const args = [
                    '-c copy',
                    '-bsf:a aac_adtstoasc'
                ]
                const command = ffmpeg(url)
                command.on('start', (commandLine) => {
                    console.log('Spawned Ffmpeg with command: ', commandLine);
                }).on('error', (err) => {
                    const idx = download.findIdx(url)
                    if (idx > -1 && !files[idx].stopped)
                        files[idx].error = true
                }).on('end', () => {
                    const idx = download.findIdx(url)
                    if (idx > -1) {
                        files[idx].finished = true
                        try {
                            const stats = fs.statSync(files[idx].filePath)
                            files[idx].total = (stats || {}).size || 0
                        } catch(e) {}
                    }
                })
                command.outputOptions(args)
                command.save(filePath)
                files.push({
                    filename,
                    url,
                    type,
                    streamId,
                    total: 0,
                    current: 0,
                    isHls: true,
                    time: Date.now(),
                    filePath,
                    error: false,
                    finished: false,
                    stopped: false,
                    meta: { url: metaUrl, type: metaType, id: metaId },
                    getCommand: () => { return command }
                })
            } else {
                const client = httpGet(url)
                const writeStream = fs.createWriteStream(filePath)
                // Push file entry BEFORE starting download to avoid race condition
                let req = null
                const fileEntry = {
                    filename,
                    url,
                    type,
                    streamId,
                    total: parseInt(total, 10) || 0,
                    current: 0,
                    time: Date.now(),
                    filePath,
                    error: false,
                    finished: false,
                    stopped: false,
                    meta: { url: metaUrl, type: metaType, id: metaId },
                    getReq: () => { return req },
                    closeStream: () => {
                        try {
                            writeStream.end()
                        } catch(e) {}
                        return true
                    }
                }
                files.push(fileEntry)
                req = client.get(url, (response) => {
                    response.pipe(writeStream)
                    response.on('data', chunk => {
                        const idx = download.findIdx(url)
                        if (idx > -1)
                            files[idx].current += chunk.length
                    })
                    response.on('end', () => {
                        const idx = download.findIdx(url)
                        if (idx > -1) {
                            writeStream.end()
                            if (files[idx].current < files[idx].total && !files[idx].stopped) {
                                files[idx].error = true
                            } else if (!files[idx].stopped) {
                                files[idx].finished = true
                            }
                        }
                    })
                    response.on('error', err => {
                        const idx = download.findIdx(url)
                        if (idx > -1 && !files[idx].stopped) {
                            files[idx].error = true
                            try { writeStream.end() } catch(e) {}
                        }
                    })
                })
                req.on('error', err => {
                    const idx = download.findIdx(url)
                    if (idx > -1 && !files[idx].stopped) {
                        files[idx].error = true
                        try { writeStream.end() } catch(e) {}
                    }
                })
            }
            if (metaUrl)
                getMeta(url, metaUrl, metaId, metaType)
        })
    },
    remove: (filename, url) => {
        let file
        let meta = {}
        files.some((el, ij) => {
            if (el.url == url) {
                file = el
                meta = JSON.parse(JSON.stringify(file.meta))
                if (file.getReq) {
                    const req = file.getReq()
                    if (req && req.destroy) req.destroy()
                }
                if (file.getCommand) {
                    const command = file.getCommand()
                    if ((command || {}).kill)
                        command.kill('SIGINT')
                }
                let waitFor
                if (files[ij].closeStream)
                    waitFor = files[ij].closeStream()
                files.splice(ij, 1)
                return true
            }
        })
        if (file) {
            try {
                fs.unlinkSync(file.filePath)
            } catch(e) {}
        }
        if (meta.id && meta.type) {
            const keepMeta = files.some(el => {
                if (el.meta.id == meta.id && el.meta.type == meta.type)
                    return true
            })
            if (!keepMeta)
                metaDir.removeMeta(meta.id, meta.type)
        }
        return true
    },
    stop: (filename, url) => {
        let file
        files.some((el, ij) => {
            if (el.url == url) {
                file = el
                if (file.getReq) {
                    const req = file.getReq()
                    if (req && req.destroy) req.destroy()
                }
                if (file.getCommand) {
                    const command = file.getCommand()
                    if ((command || {}).kill)
                        command.kill('SIGINT')
                }
                let waitFor
                if (files[ij].closeStream)
                    waitFor = files[ij].closeStream()
                files[ij].stopped = true
                return true
            }
        })
    },
    find: (url) => {
        let file
        files.some((el, ij) => {
            if (el.url == url) {
                file = el
                return true
            }
        })
        return file
    },
    findIdx: (url) => {
        let idx = -1
        files.some((el, ij) => {
            if (el.url == url) {
                idx = ij
                return true
            }
        })
        return idx
    },
    findById: (id, type) => {
        const fls = []
        files.some((el, ij) => {
            if (el.streamId == id && (el.meta || {}).type == type)
                fls.push(el)
        })
        return fls
    },
    findByMetaId: (metaId, type) => {
        const fls = []
        files.forEach(el => {
            if ((el.meta || {}).id == metaId && (el.meta || {}).type == type)
                fls.push(el)
        })
        return fls
    },
    getDownloadedMetaIds: (type) => {
        const ids = new Set()
        files.forEach(el => {
            if (el.finished && (el.meta || {}).type == type && el.meta.id)
                ids.add(el.meta.id)
        })
        return Array.from(ids)
    },
    addEntry: (entry) => {
        files.push(entry)
    },
    updateProgress: (idx, current) => {
        if (idx > -1 && idx < files.length)
            files[idx].current = current
    },
    markFinished: (idx) => {
        if (idx > -1 && idx < files.length)
            files[idx].finished = true
    },
    markError: (idx) => {
        if (idx > -1 && idx < files.length)
            files[idx].error = true
    },
    cleanEnd: cb => {
        if (saveFilesTimer)
            clearTimeout(saveFilesTimer)
        filelist.set(files)
        cb()
    }
}
module.exports = download
