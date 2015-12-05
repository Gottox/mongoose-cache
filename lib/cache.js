var LRU = require('lru-cache');

exports.install = module.exports.install = function(mongoose, options, Aggregate) {
	var cache = LRU(options);

	var log = options.debug ? console.log : function() {};

	var orig = {
		execFind: mongoose.Query.prototype.execFind,
		exec: mongoose.Query.prototype.exec
	};
	mongoose.Query.prototype.cache = function(maxAge) {
		// maxAge is optional; otherwise it will use global LRU cache options maxAge.
		this.__cached = true;
		this.__maxAge = maxAge;
		return this;
	};

	if (typeof Aggregate !== 'undefined') {
		orig.execAggregate = Aggregate.prototype.exec;
		Aggregate.prototype.cache = function(maxAge) {
			this.__cached = true;
			this.__maxAge = maxAge;
			return this;
		};
	}

	var exec = function(caller, args) {
		if (!this.__cached) {
			return orig[caller].apply(this, args);
		}
		var key = genKey(this),
			obj = cache.get(key),
			i,
			maxAge = this.__maxAge;

		if (obj) {
			log('cache hit: ', key);
			for (i = 0; i < args.length; i++) {
				if (typeof args[i] === 'function') {
					args[i](null, obj);
					break;
				}
			}
			return this;
		}

		function cacheSet(err, obj) {
			if (!err) {
				if (maxAge) {
					var maxAgeRandomized = (0.75 + 0.5 * Math.random()) * maxAge;
				}
				log('save to cache: ', key, maxAgeRandomized);
				cache.set(key, obj, maxAgeRandomized);
			}
			this.apply(this, arguments);
		}

		for (i = 0; i < args.length; i++) {
			if (typeof args[i] !== 'function')
				continue;
			args[i] = (cacheSet).bind(args[i]);
		}
		return orig[caller].apply(this, args);
	};

	function genKey(query) {
		if (query._pipeline) {
			return genKeyAggregate(query);
		}
		return JSON.stringify({
			model: query.model.modelName,
			query: query._conditions,
			fields: query._fields,
			options: query.options
		});
	}

	function genKeyAggregate(aggregate) {
		return JSON.stringify({
			model: aggregate._model.modelName,
			pipeline: aggregate._pipeline,
			options: aggregate.options
		});
	}

	mongoose.Query.prototype.execFind = function(arg1, arg2) {
		return exec.call(this, 'execFind', arguments);
	};
	mongoose.Query.prototype.exec = function(arg1, arg2) {
		return exec.call(this, 'exec', arguments);
	};
	if (typeof Aggregate !== 'undefined') {
		Aggregate.prototype.exec = function(arg1, arg2) {
			return exec.call(this, 'execAggregate', arguments);
		};
	}
	return mongoose;
};
