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
            const mongoState = mongoose.connection.readyState

            let compareDate = new Date();
            compareDate.setSeconds(compareDate.getSeconds() - 5);
            
            /**
             * 이전에 생성된 캐시 데이터가 있을 때 데이터가 생성된지 5초가 지나지 않았거나,
             * mongodb에 정상적으로 접속이 안되었다면 이전 캐시 데이터 리턴
             */
            if (new Date(cachedResults._iat) > compareDate || mongoState !== 1) {
              cachedResults = cachedResults._mongoData
              callback(null, cachedResults)
              return resolve(cachedResults)
            }
          }

          // mongodb query 실행 후 캐시 데이터 생성
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
