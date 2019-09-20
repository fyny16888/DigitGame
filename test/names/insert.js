var P = require('quick-pomelo').Promise;
module.exports = P.coroutine(function*(db, collection, docs) {
	for (var i = 0; i < docs.length; ++i)  {
		yield db.insert(collection, docs[i]);
	}
	yield db.commit();
});

module.exports.help = function() {
	console.log('function(db, collection, docs) {...}');
}

