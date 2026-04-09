const { addonBuilder, getRouter } = require('stremio-addon-sdk')
const http = require('follow-redirects').http
const https = require('follow-redirects').https
const metaDir = require('./metaDir')
const download = require('./download')
const addonConfig = require('./addon-config')

const manifest = {
    id: 'org.stremio.downloader',
    name: 'Stremio Downloader',
    version: '2.0.0',
    description: 'Download streams from Stremio for offline viewing',
    resources: ['catalog', 'meta', 'stream'],
    types: ['movie', 'series', 'channel', 'tv'],
    catalogs: [
        {
            type: 'movie',
            id: 'downloader-movie',
            name: 'Downloaded Movies'
        },
        {
            type: 'series',
            id: 'downloader-series',
            name: 'Downloaded Series'
        }
    ]
}

let endpoint = ''
let filesEndpoint = ''
let serverEndpoint = ''

const builder = new addonBuilder(manifest)

// Fetch streams from a source addon
function fetchAddonStreams(addonUrl, type, id) {
    const streamUrl = addonUrl + '/stream/' + type + '/' + encodeURIComponent(id) + '.json'
    return new Promise(resolve => {
        const client = streamUrl.startsWith('https') ? https : http
        const req = client.get(streamUrl, { timeout: 8000 }, res => {
            let body = ''
            res.on('data', chunk => { body += chunk })
            res.on('end', () => {
                try {
                    const data = JSON.parse(body)
                    resolve(data.streams || [])
                } catch(e) {
                    resolve([])
                }
            })
        })
        req.on('error', () => resolve([]))
        req.on('timeout', () => { req.destroy(); resolve([]) })
    })
}

// Convert a source stream into a download stream
function toDownloadStream(stream, source, type, id, metaType, metaId) {
    let sourceUrl = ''
    let label = ''

    if (stream.url) {
        // Direct HTTP stream
        sourceUrl = stream.url
    } else if (stream.infoHash) {
        // Torrent — route through Stremio's streaming server
        const fileIdx = stream.fileIdx || 0
        sourceUrl = 'http://127.0.0.1:11470/' + stream.infoHash + '/' + fileIdx
    } else {
        return null
    }

    // Build a descriptive label
    const name = stream.name || source.name || ''
    const title = stream.title || ''
    label = name
    if (title) label += '\n' + title

    // Build the download trigger URL
    const streamTitle = (stream.title || stream.name || id).replace(/\n/g, ' ')
    const baseMetaId = (metaId || id.split(':')[0])
    const metaUrl = 'https://v3-cinemeta.strem.io/meta/' + (metaType || type) + '/' + baseMetaId + '.json'
    const playSaveUrl = serverEndpoint + '/play-save'
        + '?url=' + encodeURIComponent(sourceUrl)
        + '&title=' + encodeURIComponent(streamTitle)
        + '&streamId=' + encodeURIComponent(id)
        + '&metaId=' + encodeURIComponent(baseMetaId)
        + '&metaType=' + encodeURIComponent(metaType || type)
        + '&metaUrl=' + encodeURIComponent(metaUrl)

    return {
        name: '⬇ ' + name,
        title: '💾 Download\n' + title,
        externalUrl: playSaveUrl
    }
}

builder.defineCatalogHandler(args => {
    return new Promise(resolve => {
        const downloadedIds = download.getDownloadedMetaIds(args.type)
        // Also include in-progress downloads
        const allFiles = download.list()
        const inProgressIds = new Set()
        allFiles.forEach(f => {
            if (!f.finished && !f.error && (f.meta || {}).type === args.type && f.meta.id)
                inProgressIds.add(f.meta.id)
        })

        const allIds = [...new Set([...downloadedIds, ...inProgressIds])]

        if (!allIds.length) {
            resolve({ metas: [] })
            return
        }
        metaDir.getAll(args.type, catalog => {
            const filtered = (catalog || []).filter(meta => allIds.includes(meta.id))

            // Add progress info to in-progress items
            filtered.forEach(meta => {
                const fileForMeta = allFiles.find(f =>
                    (f.meta || {}).id === meta.id && !f.finished && !f.error
                )
                if (fileForMeta) {
                    meta.name = '⬇ ' + (fileForMeta.progress || 0) + '% - ' + (meta.name || 'Downloading')
                }
            })

            resolve({ metas: filtered })
        })
    })
})

builder.defineMetaHandler(args => {
    return new Promise((resolve, reject) => {
        const meta = metaDir.getMeta(args.id, args.type)
        if (!meta) {
            reject(new Error('Meta not found'))
            return
        }

        // For series, filter to only downloaded episodes
        if (meta.meta && meta.meta.videos && Array.isArray(meta.meta.videos)) {
            const allFiles = download.findByMetaId(args.id, args.type)
            const downloadedStreamIds = new Set()
            allFiles.forEach(file => {
                if (file.finished)
                    downloadedStreamIds.add(file.streamId)
            })
            if (downloadedStreamIds.size > 0) {
                meta.meta.videos = meta.meta.videos.filter(video =>
                    downloadedStreamIds.has(video.id)
                )
            }
        }

        resolve(meta)
    })
})

builder.defineStreamHandler(args => {
    return new Promise(async (resolve) => {
        const downloadStreams = []

        // First: show any already-downloaded files for this content
        const fls = download.findById(args.id, args.type)
        if ((fls || []).length) {
            const files = JSON.parse(JSON.stringify(fls))
            files.filter(el => !!el.finished).forEach(file => {
                downloadStreams.push({
                    name: '✅ Downloaded',
                    title: file.filename,
                    url: filesEndpoint + '/' + encodeURIComponent(file.filename)
                })
            })
        }

        // Then: query source addons for download options
        const sources = addonConfig.getSources()
        const fetchPromises = sources.map(source =>
            fetchAddonStreams(source.url, args.type, args.id)
                .then(streams => ({ source, streams }))
        )

        const results = await Promise.all(fetchPromises)

        for (const { source, streams } of results) {
            for (const stream of streams.slice(0, 10)) {
                const dlStream = toDownloadStream(
                    stream, source, args.type, args.id,
                    args.type, args.id.split(':')[0]
                )
                if (dlStream) downloadStreams.push(dlStream)
            }
        }

        resolve({ streams: downloadStreams })
    })
})

const addonRouter = getRouter(builder.getInterface())

module.exports = {
    setEndpoint: str => {
        filesEndpoint = str
        let addonLogo = str.split('/')
        addonLogo.pop()
        addonLogo = addonLogo.join('/') + '/assets/addonLogo.png'
        manifest.logo = addonLogo
    },
    setServerEndpoint: str => {
        serverEndpoint = str
        endpoint = str
    },
    handler: addonRouter,
    getManifestUrl: (serverUrl, token) => {
        return serverUrl + '/addon-' + token + '/manifest.json'
    }
}
