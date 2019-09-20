'use strict';

var P = require('quick-pomelo').Promise;
var logger = require('quick-pomelo').logger.getLogger('animalRemote', __filename);

var Remote = function (app) {
    this.app = app;
};

module.exports = function (app) {
    return new Remote(app);
};

// 开始游戏
Remote.prototype.startGame = function (startTime, cb) {
	logger.info('===animalRemote.prototype.startGame: %s, args: %j===', this.app.getServerId(), arguments);
	var self = this;
	var app = this.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		return self.app.controllers.animal.startGameAsync(startTime);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.nodeify(cb);
};

// 结束游戏
Remote.prototype.endGame = function (cb) {
	logger.info('===animalRemote.prototype.endGame: %s, args: %j===', this.app.getServerId(), arguments);
	var self = this;
	var app = this.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		return self.app.controllers.animal.endGameAsync();
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.nodeify(cb);
};

// 切换庄家
Remote.prototype.changeBanker = function (banker, bankCount, pos, cb) {
	logger.info('===animalRemote.prototype.changeBanker: %s, args: %j===', this.app.getServerId(), arguments);
	var self = this;
	var app = this.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		return self.app.controllers.animal.changeBankerAsync(banker, bankCount, pos);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.nodeify(cb);
};

// 结算汇总
Remote.prototype.collectResult = function (maxId, maxVal, gift, cb) {
	logger.info('===animalRemote.prototype.collectResult: %s, args: %j===', this.app.getServerId(), arguments);
	var self = this;
	var app = this.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		return self.app.controllers.animal.collectResultAsync(maxId, maxVal, gift);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.nodeify(cb);
}

// 离开游戏
Remote.prototype.leaveGame = function (playerId, cb) {
	logger.info('===animalRemote.prototype.leaveGame: %s, args: %j===', this.app.getServerId(), arguments);
	var self = this;
	var app = this.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		return self.app.controllers.animal.leaveGameAsync(playerId);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.nodeify(cb);
};

// 配置游戏
Remote.prototype.configGame = function (gameConfig, cb) {
	logger.info('===animalRemote.prototype.configGame: %s, args: %j===', this.app.getServerId(), arguments);
	var self = this;
	var app = this.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		return self.app.controllers.animal.configGameAsync(gameConfig);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.nodeify(cb);
};

// 加入频道
Remote.prototype.joinChannel = function (channelId, playerId, connectorId, cb) {
	logger.info('===animalRemote.prototype.joinChannel: %s, args: %j===', this.app.getServerId(), arguments);
	return this.app.controllers.push.joinAsync(channelId, playerId, connectorId)
		.nodeify(cb);
};

// 全局消息
Remote.prototype.pushAll = function (route, msg, cb) {
	logger.info('===animalRemote.prototype.pushAll: %s, args: %j===', this.app.getServerId(), arguments);
	var app = this.app;
	return P.bind(this)
		.then(() => this.app.controllers.animal.pushMsgAsync(null, route, msg))
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.nodeify(cb);
};

// 离开频道
Remote.prototype.quitChannel = function (channelId, playerId, cb) {
	logger.info('===animalRemote.prototype.quitChannel: %s, args: %j===', this.app.getServerId(), arguments);
	return this.app.controllers.push.quitAsync(channelId, playerId)
		.nodeify(cb);
};

// 排庄变为未满
Remote.prototype.changeBanksNotFull = function (orRpc, cb) {
	logger.info('===animalRemote.prototype.changeBanksNotFull: %s, args: %j===', this.app.getServerId(), arguments);
	var res = this.app.controllers.animal.changeBanksNotFull(orRpc);
	return cb(null, res);
};

