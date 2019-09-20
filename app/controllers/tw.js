'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var _ = require('lodash');
var C = require('../../share/constant');
var User = require('../tw/user');
var Table = require('../tw/table');
var Logic = require('../tw/logic');
var logger = quick.logger.getLogger('tw', __filename);

// 构造方法
var Controller = function (app) {
    this.app = app;
    this.id = 20002;
    this.lastId = 500000;

    this.users = {};
    this.tables = [];
};

// 导出方法
module.exports = function (app) {
    return new Controller(app);
};

// 原型对象
var proto = Controller.prototype;
var cor = P.coroutine;
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

// 加入桌子
proto.joinTableAsync = P.coroutine(function* (playerId, tableId) {
    // 已有桌子
    console.log('========users========', Object.keys(this.users));
    if (this.users[playerId]) {
        return { code: C.FAILD, msg: C.TABLE_HAS_ALREADY };
    }
    // 查找桌子
    var table = _.find(this.tables, { id: tableId });
    if (!table) {
        return { code: C.FAILD, msg: C.TABLE_NOT_FOUND };
    }
    // 是否坐满
    if (table.isFull()) {
        return { code: C.FAILD, msg: C.TABLE_IS_FULL };
    }
    // 创建玩家
    var user = this._createUser(playerId, table);
    logger.info('==========joinTableAsync==%s', playerId);
    // 加入桌子
    var res = yield table.joinAsync(user);
    var player = yield this.app.models.Player.findByIdAsync(playerId, 'gameId gameServerId');
    if (player.gameServerId != '') {
        return { code: C.FAILD, msg: C.GAME_HAS_ALREADY };
    }
    // 保存游戏
    if (player) {
        player.gameId = this.id;
        player.gameServerId = this.app.getServerId();
        yield player.saveAsync();
    }
    return res;
});

// 创建桌子
proto.createTableAsync = P.coroutine(function* (playerId) {
    // 已有桌子
    if (this.users[playerId]) {
        return { code: C.FAILD, msg: C.TABLE_HAS_ALREADY };
    }
    // 创建桌子
    var table = this._createTable(playerId);
    logger.info('==========createTableAsync==%s', playerId);
    // 加入桌子
    return this.joinTableAsync(playerId, table.id);
});

// 离开桌子
proto.leaveTableAsync = P.coroutine(function* (playerId) {
    // 游戏服务
    var player = yield this.app.models.Player.findByIdAsync(playerId);
    // 置空游戏
    if (player && player.gameServerId) {
        player.gameId = 0;
        player.gameServerId = '';
        yield player.saveAsync();
    }
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.TABLE_NOT_USER };
    }
    // 移除频道
    var playerChannel = yield this.app.models.PlayerChannel.findByIdReadOnlyAsync(playerId);
    var channelIds = (playerChannel && playerChannel.channels) || [];
    for (let channelId of channelIds) {
        if (channelId.substr(0, 2) == 't:') {
            yield this.app.controllers.push.quitAsync(channelId, playerId);
        }
    }
    logger.info('==========leaveTableAsync==%s', playerId);
    yield user.table.leaveAsync(playerId);
    let countUser = user.table.countUser();
    delete this.users[playerId];
    if (countUser === 0) {
        this.tables.splice(_.findIndex(this.tables, { id: user.table.id }), 1);
        //delete user.table;
    }
    return { code: C.OK };
});

// 开始游戏
proto.beginGameAsync = P.coroutine(function* (playerId) {
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.TABLE_NOT_USER };
    }
    if (!user.isOwner()) {
        return { code: C.FAILD, msg: C.PLAYER_NOT_OWNER };
    }
    var table = user.table;
    if (!table.isEnough()) {
        return { code: C.FAILD, msg: C.PLAYER_NOT_ENOUGH };
    }
    if (!table.isReady()) {
        return { code: C.FAILD, msg: C.PLAYER_NOT_READY };
    }
    return table.startGameAsync(playerId);
});

proto.startCompareAsync = cor(function* (playerId) {
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.TABLE_NOT_USER };
    }
    var table = user.table;
    return table.startCompareAsync(user);
})

// 准备游戏
proto.gameReadyAsync = P.coroutine(function* (playerId) {
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.TABLE_NOT_USER };
    }
    if (user.state === User.STATE.PLAYING) {
        return { code: C.FAILD, msg: C.PLAYER_NOT_FREE };
    }
    if (user.table.state !== Table.STATE.FREE) {
        return { code: C.FAILD, msg: C.TABLE_NOT_FREE };
    }
    user.state = User.STATE.READY;
    yield user.table.pushMsgAsync(-1, 'ready', { chairId: user.chairId });
    return { code: C.OK };
});

//PK牌面
proto.comparePokeAsync = P.coroutine(function* (playerId, pkId, pid) {
    var user = this.users[playerId];
    var pkUser = user.table.users[pkId];
    if (user.table.id !== pkUser.table.id) {
        return { code: C.FAILD, msg: C.TABLE_NOT_SAME };
    }
    if (user.poke === -1 || pkUser.poke === -1) {
        return { code: C.FAILD, msg: C.PLAYER_MISS_POKE };
    }
    if (user.state !== User.STATE.PLAYING || pkUser.state !== User.STATE.PLAYING) {
        return { code: C.FAILD, msg: C.PLAYER_NOT_PLAYING };
    }
    let win = !!Logic.compare(user.poke[pid].cards, pkUser.poke[pid].cards);
    if (win === -1) {
        return { code: C.FAILD, msg: C.PLAYER_POKE_WRONG };
    }
    // win ? (user.state = User.STATE.FAILED) : (pkUser.state = User.STATE.FAILED);
    //桌子
    return user.table.comparePokeAsync(playerId, pkId, win);

});

proto.pickTypeAsync = cor(function* (playerId, cardObj) {
    var user = this.users[playerId];
    user.poke = cardObj;
    return { code: C.OK };
})

//加注
proto.addBetAsync = cor(function* (playerId) {
    var user = this.users[playerId];
    return user.table.addBetAsync(playerId);
});

//跟注
proto.followBetAsync = cor(function* (playerId) {
    let user = this.users[playerId];
    return user.table.followBetAsync(playerId);
});

//看牌
proto.seePokeAsync = cor(function* (playerId) {
    let user = this.users[playerId];
    if (user.isSee) return { code: C.FAILD, msg: C.PLAYER_HAD_SEE };
    user.seePoke(playerId);
    yield user.table.pushMsgAsync(-1, 'seePoke', {
        chairId: user.chairId
    });
    return { code: C.OK, data: { poke: user.poke } };
});


proto.giveUpPokeAsync = cor(function* (playerId) {
    let user = this.users[playerId];
    if (user.poke === -1) {
        return { code: C.FAILD, msg: C.PLAYER_MISS_POKE };
    }
    if (user.state !== User.STATE.PLAYING) {
        return { code: C.FAILD, msg: C.PLAYER_NOT_PLAYING };
    }
    user.state = User.STATE.FAILED;
    //桌子
    return user.table.giveUpPokeAsync(playerId);
});

// 查询桌子
proto.queryTableAsync = P.coroutine(function* (difen) {
    var tables = this.tables;
    var result = { id: 0, count: 0 };
    tables = _.filter(tables, function (t) { return t.difen == difen });
    for (let table of tables) {
        let plCount = table.getCount();
        if (plCount < 4 && plCount > result.count) {
            result.id = table.id;
            result.count = plCount;
        }
        if (result.count >= 2) break;
    }
    return result;
});