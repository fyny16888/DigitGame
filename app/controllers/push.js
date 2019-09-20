'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var push = quick.controllers.push;

function broadcastAsync(route, msg) {
	var app = this.app;
	var namespace = 'sys';
	var service = 'channelRemote';
	var method = 'broadcast';

	var servers = this.app.getServersByType('connector');

	var opts = { type: 'broadcast', userOptions: {} };
	opts.isBroadcast = true;
	if (!!opts.userOptions) {
		opts.binded = opts.userOptions.binded;
		opts.filterParam = opts.userOptions.filterParam;
	}

	var broadMsg = { msg: msg, route: route };

	var stats = [];
	for (let i = 0; i < servers.length; ++i) {
		stats.push(P.promisify(app.rpcInvoke, app)(servers[i].id, {
			namespace: namespace,
			service: service,
			method: method,
			args: [route, broadMsg, opts]
		}));
	}
	return P.all(stats);
};

var _joinAsync = P.coroutine(function* (channelId, playerId, connectorId) {
	this.channels[channelId] = this.channels[channelId] || {};
	var channel = this.channels[channelId];
	channel[playerId] = connectorId;
});

var _quitAsync = P.coroutine(function* (channelId, playerId) {
	var channel = this.channels[channelId] || {};
	if (channel[playerId]) {
		delete channel[playerId];
	}
});

var _pushAsync = P.coroutine(function* (channelId, playerIds, route, msg) {
	var channel = this.channels[channelId] || {};
	var connectorUids = {};
	if (playerIds) {
		playerIds.forEach((playerId) => {
			var connectorId = channel[playerId];
			if (connectorId) {
				if (!connectorUids[connectorId]) {
					connectorUids[connectorId] = [];
				}
				connectorUids[connectorId].push(playerId);
			}
		});
	}
	else {
		Object.keys(channel).forEach((playerId) => {
			var connectorId = channel[playerId];
			if (connectorId) {
				if (!connectorUids[connectorId]) {
					connectorUids[connectorId] = [];
				}
				connectorUids[connectorId].push(playerId);
			}
		});
	}
	var pushMsg = { msg: msg, route: route };
	Object.keys(connectorUids).forEach((connectorId) => {
		if (!this.msgBuff.hasOwnProperty(connectorId)) {
			this.msgBuff[connectorId] = [];
		}
		this.msgBuff[connectorId].push({
			uids: connectorUids[connectorId],
			route: route,
			msg: pushMsg
		});
	});
});

module.exports = function (app) {
	var _push = push(app);
	var serverType = app.getServerType();
	var gameServers = ['animal', 'golden', 'niuniu', 'ddz', 'clown', 'fruit'];
	if (-1 != gameServers.indexOf(serverType)) {
		_push.channels = {};
		_push.joinAsync = _joinAsync;
		_push.quitAsync = _quitAsync;
		_push.pushAsync = _pushAsync;
	}
	_push.broadcastAsync = broadcastAsync;
	return _push;
};

