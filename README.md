# mongoose-cache #

mongoose와 redis를 이용하여 캐시를 사용할 수 있습니다.

## Usage ##

```javascript
var mongoose = require('mongoose')
var mongooseCache = require('@nurigo/mongoose-cache')

mongooseCache(mongoose, {
  engine: 'redis',
  port: 6379,
  host: 'localhost'
})


// 로컬 redis를 사용한다면 값을 넣지 않아도 됩니다.
mongooseCache(mongoose)

Record
  .find({ some_condition: true })
  .cache(30) // 30초 동안 유지되는 캐시를 생성합니다. 값이 없거나 0이라면 파기 되지 않습니다.
  .exec(function(err, records) {
    ...
  })


Record
  .find({ parentId: userId })
  .cache(0, 'customKey') // 'customKey'라는 이름으로 된 캐시를 생성합니다.
  .exec(function(err, records) {  // 'customKey도 같이 리턴됩니다.
    ...
  });


// 아래 방법으로 캐시데이터를 임의로 삭제할 수 있습니다.
mongooseCache.clearCache('customKey')
```

## Refrence ##
https://github.com/boblauer/cachegoose

## Test ##
npm test
