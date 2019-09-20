'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var _ = require('lodash');
var C = require('../../share/constant');
var User = require('../ddz/user');
var Table = require('../ddz/table');
var logger = quick.logger.getLogger('ddz', __filename);
var TableConfig = require('../../share/config/ddz_config.json');

// 构造方法
var Controller = function (app) {
    this.app = app;
    this.id = 20001;
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
        this.tables.splice(index, 1);
    }
};

// 加入桌子
proto.joinTableAsync = P.coroutine(function* (playerId, tableId) {
    // 已有桌子
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
    // 游戏服务
    var player = yield this.app.models.Player.findByIdAsync(playerId, 'gold wateRate wateInvalid gameId gameServerId');
    if (player.gameServerId) {
        return { code: C.FAILD, msg: C.TABLE_HAS_ALREADY };
    }
    if (player.gold < table.difen * TableConfig.join_rule) {
        return { code: C.FAILD, msg: C.TABLE_NOT_GOLD };
    }
    // 抽水比例
    var wateRate = player.wateRate;
    var wateInvalid = player.wateInvalid;
    // 创建玩家
    var user = this._createUser(playerId, table);
    if ((wateInvalid > Date.now() || wateInvalid == -1) && wateRate >= 0 && wateRate < user.wateRate) {
        user.wateRate = wateRate;
    }
    logger.info('==========joinTableAsync==%s', playerId);
    // 加入桌子
    var res = yield table.joinAsync(user);
    // 保存游戏
    if (player) {
        player.gameId = this.id;
        player.gameServerId = this.app.getServerId();
        yield player.saveAsync();
    }
    return res;
});

// 创建桌子
proto.createTableAsync = P.coroutine(function* (playerId, difen) {
    difen = Number(difen || 100);
    var difen_arr = [100, 50000, 1000000];
    var df_i = _.findIndex(difen_arr, function (n) { return n == difen; });
    if (df_i == -1) {
        return { code: C.FAILD, msg: C.TABLE_NOT_FOUND };
    }
    // 已有桌子
    if (this.users[playerId]) {
        return { code: C.FAILD, msg: C.TABLE_HAS_ALREADY };
    }
    var player = yield this.app.models.Player.findByIdReadOnlyAsync(playerId, 'gameServerId gold');
    if (player.gameServerId) {
        return { code: C.FAILD, msg: C.TABLE_HAS_ALREADY };
    }
    if (player.gold < difen * TableConfig.join_rule) {
        return { code: C.FAILD, msg: C.TABLE_NOT_GOLD };
    }
    // 创建桌子
    var table = this._createTable(playerId);
    logger.info('==========createTableAsync==%s', playerId);
    table.difen = difen;
    // 加入桌子
    return this.joinTableAsync(playerId, table.id);
});

// 离开桌子
proto.leaveTableAsync = P.coroutine(function* (playerId) {
    // 查找玩家
    var user = this.users[playerId];
    var player = yield this.app.models.Player.findByIdAsync(playerId, 'gameId gameServerId');
    var gameServerId = (player && player.gameServerId) || '';
    // 内存离开
    if (user) {
        logger.info('==========leaveTableAsync==%s', playerId);
        yield user.table.leaveAsync(user);
        delete this.users[playerId];
    }
    // 离开桌子(RPC)
    if (gameServerId) {
        if (gameServerId != this.app.getServerId()) {
			this.app.rpc.ddz.ddzRemote.leaveTable.toServer(gameServerId, playerId, () => {
				logger.warn('[leaveTable]RPC playerId:', playerId, ',gameServerId:', gameServerId);
			});
        } else {
			// 置空游戏
			player.gameId = 0;
			player.gameServerId = '';
			yield player.saveAsync();
        }
    }
    return { code: C.OK };
});

// 开始游戏
proto.startGameAsync = P.coroutine(function* (playerId) {
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.TABLE_NOT_USER };
    }
    if (!user.isOwner()) {
        return { code: C.FAILD, msg: C.PLAYER_NOT_OWNER };
    }
    var table = user.table;
    if (table.state !== Table.STATE.FREE) {
        return { code: C.FAILD, msg: C.TABLE_NOT_FREE };
    }
    if (!table.isEnough()) {
        return { code: C.FAILD, msg: C.PLAYER_NOT_ENOUGH };
    }
    if (!table.isReady()) {
        return { code: C.FAILD, msg: C.PLAYER_NOT_READY };
    }
    return table.startGameAsync(user);
});

//出牌
proto.chuPaiAsync = P.coroutine(function* (playerId, pokes) {
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.TABLE_NOT_USER };
    }
    if (user.state !== User.STATE.PLAYING) {
        return { code: C.FAILD, msg: C.PLAYER_NOT_PLAYING };
    }
    if (user.table.state !== Table.STATE.PLAYING) {
        return { code: C.FAILD, msg: C.TABLE_NOT_PLAYING };
    }
    return user.table.throwPokeAsync(user, _.map(pokes, function (n) { return Number(n) }));
});

//叫分
proto.jiaoFenAsync = P.coroutine(function* (playerId, fen) {
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.TABLE_NOT_USER };
    }
    if (user.state !== User.STATE.PLAYING) {
        return { code: C.FAILD, msg: C.PLAYER_NOT_PLAYING };
    }
    if (user.table.state !== Table.STATE.CALLING) {
        return { code: C.FAILD, msg: C.TABLE_NOT_CALLING };
    }
    user.jiaofen = Number(fen);
    return user.table.makesureDZAsync(user, Number(fen));
});

//重新开始
proto.againGameAsync = P.coroutine(function* (playerId, y_n) {
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.TABLE_NOT_USER };
    }
    if (user.state !== User.STATE.FREE) {
        return { code: C.FAILD, msg: C.PLAYER_NOT_FREE };
    }
    if (user.table.state !== Table.STATE.FREE) {
        return { code: C.FAILD, msg: C.TABLE_NOT_FREE };
    }
    return user.table.againGameAsync(user, y_n);
});
// 准备状态
proto.gameReadyAsync = P.coroutine(function* (playerId) {
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.TABLE_NOT_USER };
    }
    if (user.state !== User.STATE.FREE) {
        return { code: C.FAILD, msg: C.PLAYER_NOT_FREE };
    }
    if (user.table.state !== Table.STATE.FREE) {
        return { code: C.FAILD, msg: C.TABLE_NOT_FREE };
    }
    user.state = User.STATE.READY;
    yield user.table.pushMsgAsync(-1, 'ready', { chairId: user.chairId });
    return { code: C.OK };
});

// 选择倍数
proto.setMultipleAsync = P.coroutine(function* (playerId, mul) {
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.TABLE_NOT_USER };
    }
    if (user.state != User.STATE.CALLING) {
        return { code: C.FAILD, msg: C.PLAYER_NOT_CALLING };
    }
    var table = user.table;
    if (table.state !== Table.STATE.CALLING) {
        return { code: C.FAILD, msg: C.TABLE_NOT_CALLING };
    }
    return table.setMultipleAsync(user, mul);
});

// 提交开牌
proto.commitCardAsync = P.coroutine(function* (playerId, niu) {
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.TABLE_NOT_USER };
    }
    if (user.state != User.STATE.PLAYING) {
        return { code: C.FAILD, msg: C.PLAYER_NOT_PLAYING };
    }
    var table = user.table;
    if (table.state !== Table.STATE.PLAYING) {
        return { code: C.FAILD, msg: C.TABLE_NOT_PLAYING };
    }
    return table.commitCardAsync(user, niu);
});

// 查询桌子
proto.queryTableAsync = P.coroutine(function* (difen) {
    var tables = this.tables;
    var result = { id: 0, count: 0 };
    tables = _.filter(tables, function (t) { return t.difen == difen });
    for (let table of tables) {
        let plCount = table.getCount();
        if (plCount < 3 && plCount > result.count) {
            result.id = table.id;
            result.count = plCount;
        }
        if (result.count >= 2) break;
    }
    return result;
});

