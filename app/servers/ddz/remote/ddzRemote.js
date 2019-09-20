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

Remote.prototype.leaveTable = function (playerId, cb) {
	console.log('===rpc.game.leaveTable: serverId: %s, arguments: %j', this.app.getServerId(), arguments);
	var app = this.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		return app.controllers.ddz.leaveTableAsync(playerId);
	}), app.getServerId())
		.then(function (result) {
			app.event.emit('transactionSuccess');
			return result;
		}, function (result) {
			app.event.emit('transactionFail');
			return result;
		}).nodeify(cb);
};

Remote.prototype.leaveGame = Remote.prototype.leaveTable;

Remote.prototype.queryTable = function (difen, cb) {
	console.log('===rpc.game.queryTable: serverId: %s, arguments: %j', this.app.getServerId(), arguments);
	var app = this.app;
	return app.memdb.goose.transactionAsync(P.coroutine(function* () {
		return app.controllers.ddz.queryTableAsync(difen);
	}), app.getServerId())
		.then(function (result) {
			return (app.event.emit('transactionSuccess'), result);
		}, function (result) {
			return (app.event.emit('transactionFail'), result);
		}).nodeify(cb);
};

