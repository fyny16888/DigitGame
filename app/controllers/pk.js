'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var _ = require('lodash');
var C = require('../../share/constant');
var User = require('../pk/user');
var Table = require('../pk/table');
var logger = quick.logger.getLogger('ddz', __filename);

// 构造方法
var Controller = function (app) {
    this.app = app;
    this.lastId = 500000;
    this.id = 10005;
    this.users = {};
    this.tables = [];
};

// 导出方法
module.exports = function (app) {
    return new Controller(app);
};

// 原型对象
var proto = Controller.prototype;

// 创建玩家
proto._createUser = function (playerId, table) {
    var user = new User(this, playerId, table);
    this.users[playerId] = user;
    return user;
};

// 创建桌子
proto._createTable = function (playerId) {
    this.lastId += _.random(1, 100);
    var serverId = this.app.getServerId();
    var prefix = serverId.charAt(serverId.length - 1);
    var table = new Table(this, prefix + this.lastId, playerId);
    this.tables.push(table);
    return table;
};

// 删除桌子
proto.deleteTable = function (tableId) {
    var index = _.findIndex(this.tables, { id: tableId });
    if (-1 != index) {
        for (let u of this.tables[index].users) {
            if (u) {
                this.deleteUser(u.id);
            }
        }
        this.tables.splice(index, 1);
    }
};

// 删除桌子
proto.deleteUser = function (userId) {
    if (this.users[userId]) {
        delete this.users[userId];
    }
};

// 加入桌子
proto.joinTableAsync = P.coroutine(function* (playerId, tableId, pwd) {
    // 已有桌子
    if (this.users[playerId]) {
        return { code: C.FAILD, msg: C.GAME_HAS_ALREADY };
    }
    // 查找桌子
    var table = _.find(this.tables, { id: tableId });
    if (!table) {
        return { code: C.FAILD, msg: C.GAME_NOT_IN_GAME };
    }
    if (pwd != table.pwd) {
        return { code: C.FAILD, msg: C.GAME_WRONG_PWD };
    }
    var player = yield this.app.models.Player.findByIdAsync(playerId, 'gameId gameServerId');
    if (player.gameServerId != '') {
        return { code: C.FAILD, msg: C.GAME_HAS_ALREADY };
    }
    if (player) {
        player.gameId = this.id;
        player.gameServerId = this.app.getServerId();
        yield player.saveAsync();
    }
    // 创建玩家
    var user = this._createUser(playerId, table);
    logger.info('==========joinTableAsync==%s', playerId);
    // 加入桌子
    return table.joinAsync(user);
});

// 创建桌子
proto.createTableAsync = P.coroutine(function* (playerId, gold, pwd) {
    // 已有桌子
    if (this.users[playerId]) {
        return { code: C.FAILD, msg: C.GAME_HAS_ALREADY };
    }
    var player = yield this.app.models.Player.findByIdAsync(playerId);
    if (player.gold < gold) return { code: C.FAILD, msg: C.GAME_GOLD_SMALL };
    //TODO 测试给五张票
    player.pk_ticket = player.pk_ticket || 0;
    if (player.pk_ticket <= 0) return { code: C.FAILD, msg: C.GAME_HAVE_NO_TIMES };
    player.pk_ticket -= 1;
    yield player.saveAsync();
    // 创建桌子
    var table = this._createTable(playerId);
    logger.info('==========createTableAsync==%s', playerId);
    table.gold = gold;
    table.pwd = pwd;
    // 加入桌子
    return this.joinTableAsync(playerId, table.id, pwd);
});

// 离开桌子
proto.leaveGameAsync = P.coroutine(function* (playerId) {
    // 内存离开
    var user = this.users[playerId];
    if (user) {
        logger.info('==========leaveTableAsync==%s', playerId);
        delete this.users[playerId];
        yield user.table.leaveAsync(user);
    }
    // 置空游戏
    var player = yield this.app.models.Player.findByIdAsync(playerId);
    if (player && player.gameServerId) {
        player.gameId = 0;
        player.gameServerId = '';
        yield player.saveAsync();
    }
    return { code: C.OK };
});

//出拳
proto.setHandAsync = P.coroutine(function* (playerId, type) {
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.GAME_NOT_IN_GAME };
    }
    return user.table.throwHandAsync(user, type);
});