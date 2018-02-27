'use strict'

const generateKey = require('./generate-key')
let hasBeenExtended = false

module.exports = function(mongoose, cache) {
  const aggregate = mongoose.Model.aggregate

  mongoose.Model.aggregate = function() {
    const res = aggregate.apply(this, arguments)

    if (!hasBeenExtended && res.constructor && res.constructor.name === 'Aggregate') {
      extend(res.constructor)
      hasBeenExtended = true
    }

    return res
  }

  function extend(Aggregate) {
    const exec = Aggregate.prototype.exec

    Aggregate.prototype.exec = function(callback = function() { }) {
      if (!this.hasOwnProperty('_ttl')) return exec.apply(this, arguments)

      const key = this._key || this.getCacheKey()
      const ttl = this._ttl

      return new Promise((resolve, reject) => {
        cache.get(key, (err, cachedResults) => {
          if (cachedResults) {
            let compareDate = new Date();
            compareDate.setSeconds(compareDate.getSeconds() - 5);
            
            if (new Date(cachedResults._iat) > compareDate) {
              cachedResults = cachedResults._mongoData

              callback(null, cachedResults)
              return resolve(cachedResults)
            }
          }

          exec
            .call(this)
            .then((results) => {
              results = { '_mongoData': results, _iat: new Date() }
              cache.set(key, results, ttl, () => {
                results = results._mongoData
                callback(null, results)
                resolve(results)
              })
            })
            .catch((err) => {
              callback(err)
              reject(err)
            })
        })
      })
    }

    Aggregate.prototype.cache = function(ttl = 0, customKey = '') {
      if (typeof ttl === 'string') {
        customKey = ttl
        ttl = 0
      }

      this._ttl = ttl
      this._key = customKey
      return this
    }

    Aggregate.prototype.getCacheKey = function() {
      return generateKey(this._pipeline)
    }
  }
}
