'use strict'

const generateKey = require('./generate-key')

module.exports = function(mongoose, cache) {
  const exec = mongoose.Query.prototype.exec

  // http://mongoosejs.com/docs/2.7.x/docs/api.html
  mongoose.Query.prototype.exec = function(op, callback = function() { }) {
    if (!this.hasOwnProperty('_ttl')) return exec.apply(this, arguments)
    
    if (typeof op === 'function') {
      callback = op
      op = null
    } else if (typeof op === 'string') {
      this.op = op
    }

    const key = this._key || this.getCacheKey()
    const ttl = this._ttl
    this._mongooseOptions.lean = true // lean()을 항상 사용하도록
    const model = this.model.modelName

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
              return resolve(results)
            })
          })
          .catch((err) => {
            callback(err)
            reject(err)
          })
      })
    })
  }

  mongoose.Query.prototype.cache = function(ttl = 0, customKey = '') {
    if (typeof ttl === 'string') {
      customKey = ttl
      ttl = 0
    }

    this._ttl = ttl
    this._key = customKey
    return this
  }

  mongoose.Query.prototype.getCacheKey = function() {
    const key = {
      model: this.model.modelName,
      op: this.op,
      skip: this.options.skip,
      limit: this.options.limit,
      sort: this.options.sort,
      _options: this._mongooseOptions,
      _conditions: this._conditions,
      _fields: this._fields,
      _path: this._path,
      _distinct: this._distinct
    }

    return generateKey(key)
  }
}
