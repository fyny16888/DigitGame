'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var _ = require('lodash');
var md5 = require('md5');
var uuid = require('node-uuid');
var C = require('../../share/constant');
var logger = quick.logger.getLogger('player', __filename);

var Controller = function (app) {
    this.app = app;
};

module.exports = function (app) {
    return new Controller(app);
};

var proto = Controller.prototype;

// 创建玩家
proto.createAsync = P.coroutine(function* (playerId, name, sex, headurl, spread, ip) {
    if (!name) name = 'User' + _.random(100000, 999999);
    var account = md5(playerId).toLowerCase();
    var player = new this.app.models.Player({
        _id: playerId,
        account: account,
        sex: sex || '0',
        name: name,
        registerIp: ip,
        headurl: headurl || '',
        spreader: spread || ''
    });
    var pos = playerId.lastIndexOf('@');
    if (-1 != pos && '@ai2016' == playerId.substr(pos)) {
        player.vip = _.random(0, 5);
        player.gold = _.random(50000000, 1500000000);
    }
    yield player.saveAsync();
    yield this.app.controllers.hall.initTaskAsync(playerId);
    var channelId = 'p:' + playerId;
    yield this.app.controllers.push.joinAsync(channelId, playerId);
    return player;
});

// 移除玩家
proto.removeAsync = P.coroutine(function* (playerId) {
    var player = yield this.app.models.Player.findByIdAsync(playerId);
    if (player) {
        let channelId = 'p:' + playerId;
        yield this.app.controllers.push.quitAsync(channelId, playerId);
        return player.removeAsync();
    }
});

// 连接频道
proto.connectAsync = function (playerId, connectorId, ip) {
    var player = null;
    var oldConnectorId = null;
    var oldGameId = 0;
    var oldGameSvrId = null;

    return P.bind(this)
        .then(function () {
            return this.app.models.Player.findByIdAsync(playerId, 'gold connectorId gameId gameServerId onlineTime lastLoginTime todayGold fortuneTimes lastLoginIp');
        })
        .then(function (ret) {
            player = ret;
            if (!player) {
                throw new Error('player ' + playerId + ' not exist');
            }
            oldConnectorId = player.connectorId;
            oldGameId = player.gameId;
            oldGameSvrId = player.gameServerId;

            let nowTime = new Date();
            let lastTime = new Date(player.lastLoginTime);
            if (nowTime.getMonth() != lastTime.getMonth() || nowTime.getDate() != lastTime.getDate()) {
                player.onlineTime = 0;
                player.todayGold = player.gold;
                if (player.fortuneTimes < 3) player.fortuneTimes += 1;
            }
            player.lastLoginIp = ip;
            player.connectorId = connectorId;
            player.lastLoginTime = nowTime.getTime();
            return player.saveAsync();
        })
        .then(function () {
            return this.app.controllers.push.connectAsync(playerId, connectorId);
        })
        .then(function () {
            logger.info('connect %s %s => %s', playerId, connectorId, oldConnectorId);
            return {
                oldConnectorId: oldConnectorId,
                oldGameId: oldGameId,
                oldGameSvrId: oldGameSvrId
            };
        });
};

// 断开频道
proto.disconnectAsync = function (playerId) {
    var player = null;
    var oldGameId = 0;
    var oldGameSvrId = null;

    return P.bind(this)
        .then(function () {
            return this.app.models.Player.findByIdAsync(playerId);
        })
        .then(function (ret) {
            player = ret;
            if (!player) {
                throw new Error('player ' + playerId + ' not exist');
            }
            oldGameId = player.gameId;
            oldGameSvrId = player.gameServerId;

            player.connectorId = '';
            let nowTime = Date.now();
            let lastTime = player.lastLoginTime;
            let onlineTime = player.onlineTime;
            player.onlineTime += (nowTime - lastTime);
            if (player.fortuneTimes < 3 && onlineTime < 3600000 && player.onlineTime > 3600000) {
                player.fortuneTimes += 1;
            }
            player.offlineTime = nowTime;
            return player.saveAsync();
        })
        .then(function () {
            return this.app.controllers.push.disconnectAsync(playerId);
        })
        .then(function () {
            return this.app.models.Reward.findByIdAsync('dashang');
        })
        .then(function (rew) {
            if (rew) {
                var remove_index = _.findIndex(rew.rewards, function (n) { return n._id == playerId });
                if (remove_index != -1) {
                    rew.rewards.splice(remove_index, 1);
                    return rew.saveAsync();
                }
            }
        })
        .then(function () {
            logger.info('disconnect %s', playerId);
            return {
                oldGameId: oldGameId,
                oldGameSvrId: oldGameSvrId
            };
        });
};

// 推送消息
proto.pushAsync = function (playerId, route, msg) {
    var channelId = 'p:' + playerId;
    return this.app.controllers.push.pushAsync(channelId, null, route, msg, false);
};

// 获取消息
proto.getMsgsAsync = function (playerId, seq, count) {
    var channelId = 'p:' + playerId;
    return this.app.controllers.push.getMsgsAsync(channelId, seq, count);
};

