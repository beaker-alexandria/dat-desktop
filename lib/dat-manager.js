const ipc = require('electron').ipcRenderer
const encoding = require('dat-encoding')
const shell = require('electron').shell
const assert = require('assert')
const mkdirp = require('mkdirp')
const path = require('path')

var datJson = require('./dat-json')

module.exports = createManager

// creates a wrapper for all dats. Handles stats, and updates choo's internal
// state whenever a mutation happens
function createManager ({ multidat, dbPaused, downloadsDir }, onupdate) {
  assert.ok(multidat, 'lib/dat-manager: multidat should exist')
  assert.ok(onupdate, 'lib/dat-manager: onupdate should exist')

  // add stats to all recreated dats
  var dats = multidat.list()
  dats.forEach(initDat)
  onupdate(null, dats)

  return {
    create: create,
    close: close,
    pause: pause,
    resume: resume,
    togglePause: togglePause
  }

  function create (dir, opts, cb) {
    if (!cb) {
      cb = opts
      opts = {}
    }

    assert.equal(typeof dir, 'string', 'dat-manager: dir should be a string')
    assert.equal(typeof opts, 'object', 'dat-manager: opts should be a object')
    assert.equal(typeof cb, 'function', 'dat-manager: cb should be a function')

    mkdirp(dir, function (err) {
      if (err) return cb(err)

      opts = Object.assign(opts, {
        watch: true,
        resume: true,
        ignoreHidden: true,
        compareFileContent: true
      })

      multidat.create(dir, opts, function (err, dat, duplicate) {
        duplicate = duplicate || (err && /temporarily unavailable/.test(err.message))
        if (duplicate) {
          err = new Error('Dat already exists')
          err.warn = true
        }
        if (err) return cb(err)
        var meta = datJson(dat)
        meta.write(function (err) {
          if (err) return cb(err)
          initDat(dat)
          update()
          cb(null, dat)
        })
      })
    })
  }

  function close (key, cb) {
    dbPaused.write(key, false, function (err) {
      if (err) return cb(err)
      multidat.close(key, function (err) {
        if (err) return cb(err)
        update()
        cb()
      })
    })
  }

  function pause (dat, cb) {
    var key = encoding.toStr(dat.key)
    dat.leaveNetwork()
    dbPaused.write(key, true, cb)
  }

  function resume (dat, cb) {
    var key = encoding.toStr(dat.key)
    dat.joinNetwork()
    dbPaused.write(key, false, cb)
  }

  function togglePause (dat, cb) {
    var key = encoding.toStr(dat.key)
    dbPaused.read(function (err, paused) {
      if (err) return cb(err)
      if (paused[key]) resume(dat, cb)
      else pause(dat, cb)
    })
  }

  function update () {
    var dats = multidat.list().slice()
    dats.forEach(function (dat) {
      var prevProgress = dat.progress
      try {
        var stats = dat.stats && dat.stats.get()
      } catch (_) {}
      dat.progress = (!stats)
        ? 0
        : dat.writable
          ? 1
          : Math.min(1, stats.downloaded / stats.length)
      var unfinishedBefore = prevProgress < 1 && prevProgress > 0
      if (dat.progress === 1 && unfinishedBefore) {
        var notification = new window.Notification('Download finished', {
          body: dat.metadata.title || dat.key.toString('hex')
        })
        notification.onclick = function () {
          var pathname = 'file://' + path.resolve(dat.path)
          shell.openExternal(pathname, function () {})
        }
      }
    })

    var incomplete = dats.filter(function (dat) {
      return dat.network && dat.progress < 1
    })
    var progress = incomplete.length
      ? incomplete.reduce(function (acc, dat) {
        return acc + dat.progress
      }, 0) / incomplete.length
      : 1
    if (progress === 1) progress = -1 // deactivate

    ipc.send('progress', progress)
    onupdate(null, dats)
  }

  function initDat (dat) {
    if (dat instanceof Error) return

    const key = encoding.toStr(dat.key)
    dbPaused.read((err, paused) => {
      if (err) throw err
      if (!paused[key]) {
        dat.joinNetwork()
        dat.network.on('connection', function (connection) {
          update()
          connection.on('close', update)
        })
        update()
      }
    })

    dat.metadata = {}

    multidat.readManifest(dat, function (err, manifest) {
      if (err) return
      dat.metadata.title = manifest.title
      dat.metadata.author = manifest.author
      update()
    })

    dat.archive.ready(function () {
      update()
    })

    dat.archive.on('content', function () {
      update()
    })

    if (dat.writable) dat.importFiles()

    dat.trackStats()
    dat.stats.on('update', update)
  }
}