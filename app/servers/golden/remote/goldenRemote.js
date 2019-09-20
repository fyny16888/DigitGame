'use strict';

var logger = require('quick-pomelo').logger.getLogger('game', __filename);
var P = require('quick-pomelo').Promise;
var util = require('util');

var Remote = function (app) {
	this.app = app;
};

module.exports = function (app) {
	return new Remote(app);
};
// 开始游戏
Remote.prototype.startGame = function (gameConfig, cb) {
	logger.info('===goldenRemote.prototype.startGame: %s, args: %j===', this.app.getServerId(), arguments);
	var self = this;
	var app = this.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		return app.controllers.golden.startGameAsync(gameConfig);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.nodeify(cb);
};

// 结束游戏
Remote.prototype.endGame = function (pokes, bankerWin, cb) {
	logger.info('===goldenRemote.prototype.endGame: %s, args: %j===', this.app.getServerId(), arguments);
	var self = this;
	var app = this.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		return app.controllers.golden.endGameAsync(pokes, bankerWin);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.nodeify(cb);
};

// 切换庄家
Remote.prototype.changeBanker = function (banker, bankerSeat, pos, cb) {
	logger.info('===goldenRemote.prototype.changeBanker: %s, args: %j===', this.app.getServerId(), arguments);
	var self = this;
	var app = this.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		return app.controllers.golden.changeBankerAsync(banker, bankerSeat, pos);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.nodeify(cb);
};

Remote.prototype.transGlobalData = function (gift, cb) {
	logger.info('===goldenRemote.prototype.transGlobalData: %s, args: %j===', this.app.getServerId(), arguments);
	var self = this;
	var app = this.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		return app.controllers.golden.globalDataDealAsync(gift);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.nodeify(cb);
}

// 离开游戏
Remote.prototype.leaveGame = function (playerId, cb) {
	logger.info('===goldenRemote.prototype.leaveGame: %s, args: %j===', this.app.getServerId(), arguments);
	var self = this;
	var app = this.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		return self.app.controllers.golden.leaveGameAsync(playerId);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.nodeify(cb);
};

// 加入频道
Remote.prototype.joinChannel = function (channelId, playerId, connectorId, cb) {
	logger.info('===goldenRemote.prototype.joinChannel: %s, args: %j===', this.app.getServerId(), arguments);
	return this.app.controllers.push.joinAsync(channelId, playerId, connectorId)
		.nodeify(cb);
};

// 全局消息
Remote.prototype.pushAll = function (route, msg, cb) {
	logger.info('===goldenRemote.prototype.pushAll: %s, args: %j===', this.app.getServerId(), arguments);
	var app = this.app;
	return P.bind(this)
		.then(() => this.app.controllers.golden.pushMsgAsync(null, route, msg))
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.nodeify(cb);
};

// 离开频道
Remote.prototype.quitChannel = function (channelId, playerId, cb) {
	logger.info('===goldenRemote.prototype.quitChannel: %s, args: %j===', this.app.getServerId(), arguments);
	return this.app.controllers.push.quitAsync(channelId, playerId)
		.nodeify(cb);
};
