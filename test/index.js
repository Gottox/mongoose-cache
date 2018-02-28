'use strict'

require('should')

const mongoose = require('mongoose')
const mongooseCache = require('../lib')
const Schema = mongoose.Schema

let RecordSchema
let Record
let cache
let db

describe('mongooseCache', () => {
  before((done) => {
    mongooseCache(mongoose)

    cache = mongooseCache._cache

    mongoose.connect('mongodb://127.0.0.1/mongoose-cache-test')
    db = mongoose.connection

    db.on('error', done)
    db.on('open', done)

    RecordSchema = new Schema({
      num: Number,
      str: String,
      date: {
        type: Date,
        default: Date.now
      }
    })

    RecordSchema.pre('save', function (next) {
      this._id = this.num
      next()
    })

    Record = mongoose.model('Record', RecordSchema)
  })

  beforeEach(() => {
    return generate(10)
  })

  afterEach((done) => {
    Record.remove(() => {
      cache.clear(done)
    })
  })

  it('캐시를 생성하는지 (콜백이용)', (done) => {
    getAll(60, (err, res) => {
      if (err) return done(err)

      res.length.should.equal(10)

      generate(10).then(() => {
        getAll(60, (err, res) => {
          if (err) return done(err)
          res.length.should.equal(10)
          done()
        })
      })
    })
  })

  it('캐시를 생성하는지 (Promise를 이용)', async () => {
    const res = await getAll(60)
    res.length.should.equal(10)

    await generate(10)
    const cachedRes = await getAll(60)
    cachedRes.length.should.equal(10)
  })

  it('동일한 조회를 캐시생성하지 않는지', async () => {
    const res = await getAll(60)
    res.length.should.equal(10)

    await generate(10)

    const nonCachedResponse = await getAllNoCache()
    nonCachedResponse.length.should.equal(20)
  })

  it('캐시된 데이터를 가져오는지', (done) => {
    getAll(60, (err, res) => {
      if (err) return done(err)

      const first = res[0]
      res.length.should.equal(10)

      getAll(60, (err, res2) => {
        if (err) return done(err)

        const cachedFirst = res2[0]
        res2.length.should.equal(10)
        done()
      })
    })
  })

  it('빈값을 잘 가져오는지', async () => {
    const empty = await getNone(60)
    empty.length.should.equal(0)

    await generate(10)

    const cachedEmpty = await getNone(60)
    cachedEmpty.length.should.equal(0)
  })

  it('Skip을 사용해도 잘 가져오는지', async () => {
    const res = await getWithSkip(1, 60)
    res.length.should.equal(9)

    await generate(10)

    const cachedRes = await getWithSkip(1, 60)
    cachedRes.length.should.equal(9)

    const nonCached = await getWithSkip(2, 60)
    nonCached.length.should.equal(18)
  })

  it('Limit을 사용해도 잘 가져오는지', async () => {
    const res = await getWithLimit(5, 60)
    res.length.should.equal(5)

    await Record.remove()

    const cached = await getWithLimit(5, 60)
    cached.length.should.equal(5)

    await generate(10)

    const nonCached = await getWithLimit(4, 60)
    nonCached.length.should.equal(4)
  })

  it('캐시 데이터를 다른 조건을 통해 가져와도 잘 가져와지는지', async () => {
    const res = await getWithUnorderedQuery(60)
    res.length.should.equal(10)

    await generate(10)

    const cached = await getWithUnorderedQuery(60)
    cached.length.should.equal(10)
  })

  it('Mongodb 데이터를 지워도 잘 가져오는지', async () => {
    const one = await getOne(60)
    Boolean(one).should.be.true

    await Record.remove()

    const cachedOne = await getOne(60)
    Boolean(cachedOne).should.be.true
  })

  it('정규식 조건을 줘도 잘 가져오는지', async () => {
    const res = await getAllWithRegex(60)
    res.length.should.equal(10)

    await generate(10)

    const cached = await getAllWithRegex(60)
    cached.length.should.equal(10)

    const nonCached = await getNoneWithRegex(60)
    nonCached.length.should.equal(0)
  })

  it('여러번 호출해도 잘 가져오는지', async () => {
    const res = await getAll(60)
    res.length.should.equal(10)

    await generate(10)

    await Promise.all(new Array(20).join('.').split('').map(() => getAll(60)))

    const cached = await getAll(60)
    cached.length.should.equal(10)
  })

  it('캐시에 만료기간을 줬을 때 만료가 잘 되는지', (done) => {
    getAll(1, () => {
      setTimeout(() => {
        getAll(1, (err, res) => {
          if (err) return done(err)

          Boolean(res._fromCache).should.be.false
          done()
        })
      }, 1200)
    })
  })

  it('Aggregate를 썼을 때 잘 가져오는지 (콜백이용)', (done) => {
    aggregate(60, (err, res) => {
      if (err) return done(err)
      res[0].total.should.equal(45)

      generate(10).then(() => {
        aggregate(60, (err, cached) => {
          if (err) return done(err)
          cached[0].total.should.equal(45)
          done()
        })
      })
    })
  })

  it('Aggregate를 썼을 때 잘 가져오는지 (Promises이용)', async () => {
    const [res] = await aggregate(60)
    res.total.should.equal(45)

    await generate(10)

    const [cached] = await aggregate(60)
    cached.total.should.equal(45)
  })

  it('캐시삭제가 잘 되는지', async () => {
    const res = await getAllCustomKey(60, 'custom-key')
    res.length.should.equal(10)

    await generate(10)

    const cached = await getAllCustomKey(60, 'custom-key')
    cached.length.should.equal(10)

    mongooseCache.clearCache('custom-key')

    setTimeout(() => {
      getAllCustomKey(60, 'custom-key', (err, res) => {
        res.length.should.equal(20)
      })
    }, 1000)
  })

  it('Count를 하였을 때 잘 되는지', async () => {
    const res = await count(60)
    res.should.equal(10)

    await generate(10)

    const cached = await count(60)
    cached.should.equal(10)
  })

  it('Sort를 이용했을 때 잘 되는지', async () => {
    const res = await getAllSorted({ num: 1 })
    res.length.should.equal(10)

    await generate(10)

    const cached = await getAllSorted({ num: 1 })
    cached.length.should.equal(10)

    const diffSort = await getAllSorted({ num: -1 })
    diffSort.length.should.equal(20)
  })
})

function getAll(ttl, cb) {
  return Record.find({}).cache(ttl).exec(cb)
}

function getAllCustomKey(ttl, key, cb) {
  return Record.find({}).cache(ttl, key).exec(cb)
}

function getAllNoCache(cb) {
  return Record.find({}).exec(cb)
}

function getOne(ttl, cb) {
  return Record.findOne({ num: { $gt: 2 } }).cache(ttl).exec(cb)
}

function getWithSkip(skip, ttl, cb) {
  return Record.find({}).skip(skip).cache(ttl).exec(cb)
}

function getWithLimit(limit, ttl, cb) {
  return Record.find({}).limit(limit).cache(ttl).exec(cb)
}

function getNone(ttl, cb) {
  return Record.find({ notFound: true }).cache(ttl).exec(cb)
}

function getAllWithRegex(ttl, cb) {
  return Record.find({ str: { $regex: /\d/ } }).cache(ttl).exec(cb)
}

function getNoneWithRegex(ttl, cb) {
  return Record.find({ str: { $regex: /\d\d/ } }).cache(ttl).exec(cb)
}

function getWithUnorderedQuery(ttl, cb) {
  getWithUnorderedQuery.flag = !getWithUnorderedQuery.flag
  if (getWithUnorderedQuery.flag) {
    return Record.find({ num: { $exists: true }, str: { $exists: true } }).cache(ttl).exec(cb)
  } else {
    return Record.find({ str: { $exists: true }, num: { $exists: true } }).cache(ttl).exec(cb)
  }
}

function getAllSorted(sortObj) {
  return Record.find({}).sort(sortObj).cache(60).exec()
}

function count(ttl, cb) {
  return Record.find({})
    .cache(ttl)
    .count()
    .exec(cb)
}

function aggregate(ttl, cb) {
  return Record.aggregate()
    .group({ _id: null, total: { $sum: '$num' } })
    .cache(ttl)
    .exec(cb)
}

function generate(amount) {
  const records = []
  let count = 0
  while (count < amount) {
    records.push({
      num: count,
      str: count.toString()
    })
    count++
  }

  return Record.create(records)
}
