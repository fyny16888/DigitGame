'use strict';

var P = require('quick-pomelo').Promise;
var logger = require('quick-pomelo').logger.getLogger('pkRemote', __filename);

var Remote = function (app) {
    this.app = app;
};

module.exports = function (app) {
    return new Remote(app);
};

// 离开游戏
Remote.prototype.leaveGame = function (playerId, cb) {
	logger.info('===pkRemote.prototype.leaveGame: %s, args: %j===', this.app.getServerId(), arguments);
	var self = this;
	var app = this.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
			return self.app.controllers.pk.leaveGameAsync(playerId);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.nodeify(cb);
};

