'use strict';

var P = require('quick-pomelo').Promise;
var logger = require('quick-pomelo').logger.getLogger('clownRemote', __filename);

var Remote = function (app) {
    this.app = app;
};

module.exports = function (app) {
    return new Remote(app);
};

// 加入频道
Remote.prototype.joinChannel = function (channelId, playerId, connectorId, cb) {
	logger.info('===clownRemote.prototype.joinChannel: %s, args: %j===', this.app.getServerId(), arguments);
	return this.app.controllers.push.joinAsync(channelId, playerId, connectorId)
		.nodeify(cb);
};

// 全局消息
Remote.prototype.pushAll = function (route, msg, cb) {
	logger.info('===clownRemote.prototype.pushAll: %s, args: %j===', this.app.getServerId(), arguments);
	var app = this.app;
	return P.bind(this)
		.then(() => this.app.controllers.clown.pushMsgAsync(null, route, msg))
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.nodeify(cb);
};

// 离开频道
Remote.prototype.quitChannel = function (channelId, playerId, cb) {
	logger.info('===clownRemote.prototype.quitChannel: %s, args: %j===', this.app.getServerId(), arguments);
	return this.app.controllers.push.quitAsync(channelId, playerId)
		.nodeify(cb);
};

// 离开游戏
Remote.prototype.leaveGame = function (playerId, cb) {
	logger.info('===clownRemote.prototype.leaveGame: %s, args: %j===', this.app.getServerId(), arguments);
	var self = this;
	var app = this.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		return self.app.controllers.clown.leaveGameAsync(playerId);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.nodeify(cb);
};

// 游戏配置
Remote.prototype.configGame = function (gameConfig, cb) {
	logger.info('===clownRemote.prototype.configGame: %s, args: %j===', this.app.getServerId(), arguments);
	return this.app.controllers.clown.configGameAsync(gameConfig)
		.nodeify(cb);
};

