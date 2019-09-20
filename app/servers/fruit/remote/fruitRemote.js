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
	logger.info('===fruitRemote.prototype.startGame: %s, args: %j===', this.app.getServerId(), arguments);
	var self = this;
	var app = this.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		return self.app.controllers.fruit.startGameAsync(startTime);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.nodeify(cb);
};

// 结束游戏
Remote.prototype.endGame = function (cb) {
	logger.info('===fruitRemote.prototype.endGame: %s, args: %j===', this.app.getServerId(), arguments);
	var self = this;
	var app = this.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		return self.app.controllers.fruit.endGameAsync();
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.nodeify(cb);
};

// 切换庄家
Remote.prototype.changeBanker = function (banker, bankCount, pos, cb) {
	logger.info('===fruitRemote.prototype.changeBanker: %s, args: %j===', this.app.getServerId(), arguments);
	var self = this;
	var app = this.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		return self.app.controllers.fruit.changeBankerAsync(banker, bankCount, pos);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.nodeify(cb);
};

// 结算汇总
Remote.prototype.collectResult = function (maxId, maxVal, gift, cb) {
	logger.info('===fruitRemote.prototype.collectResult: %s, args: %j===', this.app.getServerId(), arguments);
	var self = this;
	var app = this.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		return self.app.controllers.fruit.collectResultAsync(maxId, maxVal, gift);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.nodeify(cb);
}

// 离开游戏
Remote.prototype.leaveGame = function (playerId, cb) {
	logger.info('===fruitRemote.prototype.leaveGame: %s, args: %j===', this.app.getServerId(), arguments);
	var self = this;
	var app = this.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		return self.app.controllers.fruit.leaveGameAsync(playerId);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.nodeify(cb);
};

// 配置游戏
Remote.prototype.configGame = function (gameConfig, cb) {
	logger.info('===fruitRemote.prototype.configGame: %s, args: %j===', this.app.getServerId(), arguments);
	var self = this;
	var app = this.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		return self.app.controllers.fruit.configGameAsync(gameConfig);
	}), app.getServerId())
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.nodeify(cb);
};

// 加入频道
Remote.prototype.joinChannel = function (channelId, playerId, connectorId, cb) {
	logger.info('===fruitRemote.prototype.joinChannel: %s, args: %j===', this.app.getServerId(), arguments);
	return this.app.controllers.push.joinAsync(channelId, playerId, connectorId)
		.nodeify(cb);
};

// 全局消息
Remote.prototype.pushAll = function (route, msg, cb) {
	logger.info('===fruitRemote.prototype.pushAll: %s, args: %j===', this.app.getServerId(), arguments);
	var app = this.app;
	return P.bind(this)
		.then(() => this.app.controllers.fruit.pushMsgAsync(null, route, msg))
		.then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
		.nodeify(cb);
};

// 离开频道
Remote.prototype.quitChannel = function (channelId, playerId, cb) {
	logger.info('===fruitRemote.prototype.quitChannel: %s, args: %j===', this.app.getServerId(), arguments);
	return this.app.controllers.push.quitAsync(channelId, playerId)
		.nodeify(cb);
};

// 排庄变为未满
Remote.prototype.changeBanksNotFull = function (orRpc, cb) {
	logger.info('===fruitRemote.prototype.changeBanksNotFull: %s, args: %j===', this.app.getServerId(), arguments);
	var res = this.app.controllers.fruit.changeBanksNotFull(orRpc);
	return cb(null, res);
};

// 单局赢最多
Remote.prototype.getGlobalMaxWinner = function (cb) {
	logger.info('===fruitRemote.prototype.getGlobalMaxWinner: %s, args: %j===', this.app.getServerId(), arguments);
	var fruit = this.app.controllers.fruit;
	return cb(null, { gmaxId: fruit.gmaxId, gmaxVal: fruit.gmaxVal });
};

