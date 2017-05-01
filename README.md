[![Flattr this git repo](http://api.flattr.com/button/flattr-badge-large.png)](https://flattr.com/submit/auto?user_id=Gottox&url=https://github.com/Gottox/mongoose-cache&title=mongoose-cache&language=&tags=github&category=software)


### mongoose-cache

Monkey patches Mongoose.Query to support in-memory caching.

## usage

Monkey-Patching mongoose:

```javascript
var mongoose = require('./mongoose')
var cacheOpts = {
	max:50,
	maxAge:1000*60*2
};
require('mongoose-cache').install(mongoose, cacheOpts)
```

This means "cache up to 50 querys with a livetime of two minutes".
See <https://github.com/isaacs/node-lru-cache#options> for all available
options.

For enabling this cache in your query just call .cache()

```javascript
db.User.find({ ... }).cache().exec(function() { ... })
```

To invalidate the cache for a query, just call invalidateCache()
```javascript
db.User.find({ ... }).invalidateCache().exec(function() { ... })
```
This will clear the current query from the cache, other queries may remain
in the cache, nevertheless. If you want to clear/reset the whole cache, run
invalidateCache(true) on Query
```javascript
db.User.find({ ... }).invalidateCache(true).exec(function() { ... })
```

For more talky output add ```debug: true``` to the cacheOpts.
