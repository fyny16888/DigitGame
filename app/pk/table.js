'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var cor = P.coroutine;
var _ = require('lodash');
var User = require('./user');
var C = require('../../share/constant');
var logger = quick.logger.getLogger('table', __filename);

var NOTICE_TYPE = { join: 1, result: 2, leave: 3 };

// 构造方法
var Table = function (game, id, ownerId) {
    this.game = game;
    this.id = id;
    this.gold = -1;
    this.count = 2;
    this.pwd = -1;
    // 桌主
    this.ownerId = ownerId;
    this.users = Array(this.count);
    this.hands = [-1, -1];
};

// 导出类
module.exports = Table;

// 原型对象
var proto = Table.prototype;

// 是否坐满
proto.isFull = function () {
    for (let user of this.users) {
        if (!user) {
            return false;
        }
    }
    return true;
};

// 发送消息
proto.pushMsgAsync = P.coroutine(function* (playerIds, route, msg) {
    var app = this.game.app;
    var self = this;
    if (playerIds.length > 0) {
        return process.nextTick(function () {
            return app.memdb.goose.transactionAsync(cor(function* () {
                for (let p of playerIds) {
                    yield app.controllers.player.pushAsync(p, route, msg);
                }
            }), app.getServerId())
                .then(function () {
                    return app.event.emit('transactionSuccess');
                }, function () {
                    return app.event.emit('transactionFail');
                });
        });
    }
});

// 加入桌子之后
proto.afterJoinAsync = cor(function* (user) {

});

// 离开桌子之前
proto.beforeLeaveAsync = cor(function* (user) {

});

// 离开桌子之后
proto.afterLeaveAsync = cor(function* (user) {
    var player = yield this.game.app.models.Player.findByIdReadOnlyAsync(user.id, 'name account');
    this.game.deleteUser(user.id);
    if (user.id == this.ownerId) {
        this.game.deleteTable(this.id);
    }
    var ids = [];
    for (let u of this.users) {
        if (u) {
            ids.push(u.id);
        }
    }
    yield this.pushMsgAsync(ids, 'pk_event', { type: NOTICE_TYPE.leave, name: player.name, account: player.account });
    return { code: C.OK };
});

// 加入桌子
proto.joinAsync = cor(function* (user) {
    var data = [];
    var joined = false;
    var users = this.users;
    var ids = []; var owner = {};
    for (let i = 0; i < users.length; ++i) {
        if (!users[i] && !joined) {
            // 坐下
            user.chairId = i;
            users[i] = user;
            joined = true;
        }
        if (users[i]) {
            var player = yield this.game.app.models.Player.findByIdReadOnlyAsync(users[i].id, 'gold vip headurl name account');
            data.push({ gold: player.gold, vip: player.vip, chairId: users[i].chairId, headurl: player.headurl, name: player.name, account: player.account });
            if (users[i] != user.id) { ids.push(users[i].id); owner = { gold: player.gold, vip: player.vip, chairId: users[i].chairId, headurl: player.headurl, name: player.name, account: player.account } }
        }
    }
    // 加入桌子之后
    yield this.afterJoinAsync(user);
    yield this.pushMsgAsync(ids, 'pk_event', { type: NOTICE_TYPE.join, data: data });
    if (user.id != this.ownerId) {
        return { code: C.OK, data: { money: this.gold, player: owner } };
    }
    var table = { room: this.id, money: this.gold, password: this.pwd };
    return { code: C.OK, data: table };
});

// 离开桌子
proto.leaveAsync = cor(function* (user) {
    yield this.beforeLeaveAsync(user);
    let chairId = user.chairId;
    delete this.users[chairId];
    yield this.afterLeaveAsync(user);
});

// 出拳
proto.throwHandAsync = cor(function* (user, selfHand) {
    var hand = this.hands[user.chairId];
    if (hand > -1) {
        return { code: C.FAILD, msg: C.GAME_HAS_SET };
    }
    if (!this.isFull()) {
        return { code: C.FAILD, msg: C.GAME_NOT_FULL };
    }
    this.hands[user.chairId] = selfHand;
    var compare = true; var ids = [];
    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i]) {
            ids.push(this.users[i].id);
        }
        if (this.hands[i] == -1) {
            compare = false;
            break;
        }
    }
    if (compare) {
        var result = this.compareHand(this.hands);
        yield this.pushMsgAsync(ids, 'pk_event', { type: NOTICE_TYPE.result, result: result, hands: this.hands });
        yield this.completeGameAsync(result);
    }
    return { code: C.OK };
});

// 比较拳
proto.compareHand = function (hands) {
    var sh = hands[0];
    var oh = hands[1];
    //0锤子 1剪刀 2包袱
    if (sh == oh) return -1;
    var wl = { 0: 1, 1: 2, 2: 0 };
    for (var w in wl) {
        if (w == sh) {
            if (oh == wl[w]) {
                return 0;
            }
        }
        if (wl[w] == sh) {
            if (w == oh) {
                return 1;
            }
        }
    }
    return -1;
};

//完成游戏
proto.completeGameAsync = cor(function* (result) {
    if (result != -1) {
        var winId = result;
        var loseId = ((result == 1) ? 0 : 1);
        var app = this.game.app;
        var lose = yield app.models.Player.findByIdAsync(this.users[loseId].id, 'gold');
        var gold = (this.gold > lose.gold ? lose.gold : this.gold);
        lose.gold -= gold;
        yield lose.saveAsync();
        var win = yield app.models.Player.findByIdAsync(this.users[winId].id, 'gold');
        win.gold += gold;
        yield win.saveAsync();
    }
    return this.game.deleteTable(this.id);
});