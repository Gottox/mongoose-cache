'use strict'

const Cacheman = require('cacheman')
const noop = () => {}

function Cache(options) {
  if (Object.prototype.toString.call(options) !== '[object Object]') {
    throw new Error('cache option은 object형식만 지원 가능합니다')
  }
  if (!Object.keys(options).length) {
    options = { 'engine': 'redis', 'port': 6379, 'host': 'localhost' }
  }
  this._cache = new Cacheman('mongoose-cache', options)
}

Cache.prototype.get = function(key, cb = noop) {
  return this._cache.get(key, cb)
}

Cache.prototype.set = function(key, value, ttl, cb = noop) {
  if (ttl === 0) ttl = -1
  return this._cache.set(key, value, ttl, cb)
}

Cache.prototype.del = function(key, cb = noop) {
  return this._cache.del(key, cb)
}

Cache.prototype.clear = function(cb = noop) {
  return this._cache.clear(cb)
}

module.exports = function(options) {
  return new Cache(options)
}
