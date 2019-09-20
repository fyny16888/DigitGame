'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var util = require('util');
var _ = require('lodash');
var uuid = require('node-uuid');
var User = require('../clown/user');
var C = require('../../share/constant');
var H = require('../../share/const').TASK_TYPE;
var logger = quick.logger.getLogger('clown', __filename);


// 构造方法
var Controller = function (app) {
    this.app = app;
    this.id = 20003;
    this.users = {};

    this.timeOut = 60000;
    this.starCount = 8;
    this.clowns = {};
    this.addGift = 0;
    this.messages = [];

    this.config = {
        0: { mul: 0, per: 600 },
        1: { mul: 1000, per: 1 },
        2: { mul: 500, per: 9 },
        3: { mul: 50, per: 10 },
        4: { mul: 20, per: 20 },
        5: { mul: 10, per: 40 },
        6: { mul: 4, per: 40 },
        7: { mul: 3, per: 80 },
        8: { mul: 2, per: 100 },
        9: { mul: 1, per: 100 }
    };
    this.winRand = 0.4;
    this.gifRand = 0.01;
    this.wateRate = 0.05;
    if (app.getServerType() == 'clown') app.event.on('start_server', () => this.initAsync());
};

// 导出方法
module.exports = function (app) {
    return new Controller(app);
};

// 原型对象
var proto = Controller.prototype;

// 初始化服务
proto.initAsync = P.coroutine(function* () {
    var self = this;
    var app = self.app;
    var gameConfig = null;
    var isNew = false;
    yield app.memdb.goose.transactionAsync(P.coroutine(function* () {
        gameConfig = yield self.app.models.GameConfig.findByIdReadOnlyAsync(self.id);
        if (!gameConfig) {
            gameConfig = new self.app.models.GameConfig({
                _id: self.id, config: {
                    config: self.config,
                    winRand: self.winRand,
                    gifRand: self.gifRand,
                    wateRate: self.wateRate
                }
            });
            isNew = true;
            return gameConfig.saveAsync();
        }
    }), app.getServerId()).then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
    if (gameConfig && !isNew) {
        this.config = gameConfig.config.config;
        this.winRand = gameConfig.config.winRand;
        this.gifRand = gameConfig.config.gifRand;
        this.wateRate = gameConfig.config.wateRate;
    }
});

// 配置游戏
proto.configGameAsync = P.coroutine(function* (gameConfig) {
    var sum = 0;
    _.map(gameConfig.config, function (n) { sum += n.per; return true; });
    if (sum != 1000) return;
    if (gameConfig.winRand < 0 || gameConfig.winRand > 1) return;
    if (gameConfig.gifRand < 0 || gameConfig.gifRand > 1) return;
    if (gameConfig.wateRate < 0 || gameConfig.wateRate > 1) return;
    this.config = gameConfig.config;
    this.winRand = gameConfig.winRand;
    this.gifRand = gameConfig.gifRand;
    this.wateRate = gameConfig.wateRate;
    var self = this;
    var app = self.app;
    return app.memdb.goose.transactionAsync(P.coroutine(function* () {
        var gc = yield self.app.models.GameConfig.findByIdAsync(self.id);
        for (let at in gc.config) {
            if (gameConfig[at]) {
                gc.config[at] = gameConfig[at];
            }
        }
        console.warn('gc', gc);
        gc.markModified('config');
        return gc.saveAsync();
    }), app.getServerId())
        .then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
});

// 创建玩家
proto._createUser = function (player) {
    return new User(this, player);
};

// 添加玩家
proto._addUser = function (user) {
    this.users[user.id] = user;
};

// 删除玩家
proto._deleteUser = function (user) {
    if (this.users[user.id]) {
        delete this.users[user.id];
        delete this.clowns[user.id];
    }
};

// 添加消息
proto.addMessage = function (msg) {
    if (this.messages.length >= 5) this.messages.shift();
    this.messages.push(msg);
};

// 发送消息
proto.pushMsgAsync = P.coroutine(function* (playerIds, route, msg) {
    var channelId = 'g:' + this.id;
    return this.app.controllers.push.pushAsync(channelId, playerIds, route, msg);
});

// 通知本进程
proto.notifyAsync = P.coroutine(function* (route, msg) {
    var ids = Object.keys(this.users);
    if (ids.length > 0) {
        return this.pushMsgAsync(ids, route, msg);
    }
});

// 通知本游戏
proto.notifyAllAsync = P.coroutine(function* (route, msg) {
    var mainServer = this.app.getServersByType('clown')[0];
    if (this.app.getServerId() == mainServer.id) {
        return this.pushMsgAsync(null, route, msg);
    }
    else {
        let clownRemote = this.app.rpc.clown.clownRemote;
        return clownRemote.pushAll.toServer(mainServer.id, route, msg, () => { });
    }
});

// 加入游戏
proto.joinGameAsync = P.coroutine(function* (playerId) {
    // 查找玩家
    var user = this.users[playerId];
    if (user) {
        return { code: C.FAILD, msg: C.GAME_HAS_ALREADY };
    }
    // 查询玩家
    var player = yield this.app.models.Player.findByIdAsync(playerId, 'account name sex headurl vip gold wateRate wateInvalid gameId gameServerId connectorId');
    if (player.gameServerId) {
        return { code: C.FAILD, msg: C.GAME_HAS_ALREADY };
    }
    // 创建玩家
    var user = this._createUser(player);
    // 抽水比例
    var wateRate = player.wateRate;
    var wateInvalid = player.wateInvalid;
    if ((wateInvalid > Date.now() || wateInvalid == -1) && wateRate >= 0 && wateRate < user.wateRate) user.wateRate = wateRate;
    // 添加玩家
    logger.info('==========joinGameAsync==%s', playerId);
    yield this.beforeJoinGameAsync(user);
    this._addUser(user);
    yield this.afterJoinGameAsync(user);
    // 保存游戏
    player.gameId = this.id;
    player.gameServerId = this.app.getServerId();
    yield player.saveAsync();
    // 房间信息
    var roomInfo = yield this.roomInfoAsync(user);
    return { code: C.OK, data: roomInfo };
});

// 加入游戏之前
proto.beforeJoinGameAsync = P.coroutine(function* (user) {
    let connectorId = user.connectorId || '';
    let channelId = 'g:' + this.id;
    yield this.app.controllers.push.joinAsync(channelId, user.id, connectorId);
    var mainServer = this.app.getServersByType('clown')[0];
    if (this.app.getServerId() != mainServer.id) {
        let clownRemote = this.app.rpc.clown.clownRemote;
        return clownRemote.joinChannel.toServer(mainServer.id, channelId, user.id, connectorId, () => { });
    }
});

// 加入游戏之后
proto.afterJoinGameAsync = P.coroutine(function* (user) { });

// 离开游戏
proto.leaveGameAsync = P.coroutine(function* (playerId) {
    // 查找玩家
    var user = this.users[playerId];
    // 内存离开
    if (user) {
        logger.info('==========leaveGameAsync==%s', playerId);
        yield this.beforeLeaveGameAsync(user);
        this._deleteUser(user);
        yield this.afterLeaveGameAsync(user);
    }
    // 置空游戏
    let player = yield this.app.models.Player.findByIdAsync(playerId, 'gameId gameServerId');
    if (player.gameServerId) {
        player.gameId = 0;
        player.gameServerId = '';
        yield player.saveAsync();
    }
    return { code: C.OK };
});

// 离开游戏之前
proto.beforeLeaveGameAsync = P.coroutine(function* (user) {
    let channelId = 'g:' + this.id;
    yield this.app.controllers.push.quitAsync(channelId, user.id);
    var mainServer = this.app.getServersByType('clown')[0];
    if (this.app.getServerId() != mainServer.id) {
        let clownRemote = this.app.rpc.clown.clownRemote;
        return clownRemote.quitChannel.toServer(mainServer.id, channelId, user.id, () => { });
    }
});

// 离开游戏之后
proto.afterLeaveGameAsync = P.coroutine(function* (user) { });

// 获取房间信息
proto.roomInfoAsync = P.coroutine(function* (user) {
    var clownPlayer = yield this.app.models.ClownPlayer.findByIdReadOnlyAsync(user.id, 'wWin dWin lastTime');
    if (clownPlayer) {
        user.wWin = clownPlayer.wWin;
        user.dWin = clownPlayer.dWin;
        user.lastTime = clownPlayer.lastTime;
    }
    var clownInfo = yield this.app.models.ClownInfo.findByIdReadOnlyAsync(this.id, 'tGift maxId');
    if (!clownInfo) {
        clownInfo = new this.app.models.ClownInfo({ _id: this.id });
    }
    var data = { max_user: { account: '', name: '', sex: '0', headurl: '' }, gift: 0 };
    // 彩金池
    if (clownInfo.tGift) {
        data.gift = clownInfo.tGift;
    }
    // 冠军玩家
    if (clownInfo.maxId) {
        let player = yield this.app.models.Player.findByIdReadOnlyAsync(clownInfo.maxId, 'account name sex, headurl');
        if (player) {
            data.max_user.account = player.account;
            data.max_user.name = player.name;
            data.max_user.sex = player.sex;
            data.max_user.headurl = player.headurl;
        }
    }
    if (clownInfo.isNew) yield clownInfo.saveAsync();
    return data;
});

// 计算转盘
proto.genResult = function () {
    var per = _.random(0, 999);
    var sum = 0;
    var rid = 0;
    for (let id in this.config) {
        let bet = this.config[id];
        sum += bet.per;
        if (per < sum) {
            rid = Number(id);
            break;
        }
    }
    var data = {};
    if (rid != 0) {
        data.res = [rid, rid, rid];
        data.mul = this.config[rid].mul;
    } else {
        let first = _.random(1, 9);
        let third = 0;
        if (first == 1) third = _.random(2, 9);
        else if (first == 9) third = _.random(1, 8);
        else third = _.sample([_.random(1, first - 1), _.random(first + 1, 9)]);
        let res = [first, _.random(1, 9), third];
        data.res = res;
        data.mul = this.config[0].mul;
    }
    return data;
};

// 请求一次转盘
proto.randResultAsync = P.coroutine(function* (playerId, cell) {
    // 查找玩家
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.GAME_NOT_IN_GAME };
    }
    // 下注额
    const VALUES = { 50: 50, 100: 100, 500: 500, 1000: 1000, 5000: 5000, 10000: 10000, 100000: 100000 };
    if (!VALUES[cell]) {
        return { code: C.FAILD, msg: C.GAME_PARAM_ERROR };
    }
    if (cell >= 10000 && user.vip <= 0) {
        return { code: C.FAILD, msg: C.GAME_LOW_VIP };
    }
    if (user.gold < cell) {
        return { code: C.FAILD, msg: C.GAME_GOLD_SMALL };
    }
    // 扣除底注
    user.gold -= cell;
    // 重置排名
    user.resetRank();
    // 产生结果
    var result = this.genResult();
    var real = 0;
    if (result.mul > 0) {
        let win = result.mul * cell;
        this.startClown(user, cell, win);
        let water = Math.floor(win * user.wateRate);
        real = win - water;
        user.gold += real;
        user.wWin += real;
        user.dWin += real;
        this.addGift += water;
    }
    // 查询玩家
    var player = yield this.app.models.Player.findByIdAsync(playerId, 'gold');
    if (player.gold != user.gold) {
        player.gold = user.gold;
        yield player.saveAsync();
    }
    // 记录排名
    if (result.mul <= 0) {
        yield this.recordRankAsync(user);
    }
    return { code: C.OK, data: { res: result.res, win: real } };
});

// 开始小丑
proto.startClown = function (user, base, cell) {
    var clown = this.clowns[user.id];
    if (!clown) {
        clown = {
            star: 0,
            base: base,
            cell: cell,
            win: 0,
            endTime: Date.now() + this.timeOut
        };
        this.clowns[user.id] = clown;
    } else {
        clown.star = 0;
        clown.base = base;
        clown.cell = cell;
        clown.win = 0;
        clown.endTime = Date.now() + this.timeOut;
    }
};

// 选小丑
proto.chooseClownAsync = P.coroutine(function* (playerId, plusMul) {
    // 查找玩家
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.GAME_NOT_IN_GAME };
    }
    // 小丑状态
    var clown = this.clowns[playerId];
    if (!clown) {
        return { code: C.FAILD, msg: C.CLOWN_GAME_OVER };
    }
    var nowTime = Date.now();
    if (clown.star >= this.starCount || clown.endTime <= nowTime) {
        return { code: C.FAILD, msg: C.CLOWN_GAME_OVER };
    }
    // 是否加倍
    var gold = plusMul ? clown.cell * 2 : clown.cell;
    if (user.gold < gold) {
        return { code: C.FAILD, msg: C.GAME_GOLD_SMALL };
    }
    // 计算结果
    var data = { gift: 0 };
    var isGift = false;
    var result = Math.random() < this.winRand ? 1 : 0;
    if (result > 0) {
        let water = Math.floor(gold * user.wateRate);
        user.gold += gold - water;
        user.wWin += gold - water;
        user.dWin += gold - water;
        clown.win += gold - water;
        clown.cell *= 2;
        clown.star += 1;
        this.addGift += water;
        isGift = (clown.star % 4 == 0);
    } else {
        user.gold -= gold;
    }
    // 爆彩金
    if (isGift) {
        let rand = Math.random();
        if (rand < this.gifRand) {
            user.gold += clown.base * 2000;
            user.wWin += clown.base * 2000;
            user.dWin += clown.base * 2000;
            clown.win += clown.base * 2000;
            data.gift = clown.base * 2000;
            this.addGift -= clown.base * 2000;
        }
    }
    data.res = result;
    data.star = clown.star;
    data.cell = clown.cell;
    data.win = result > 0 ? gold - Math.floor(gold * user.wateRate) : -gold;
    // 是否结束
    var isEnd = false;
    if (clown.star < this.starCount) {
        clown.endTime = nowTime + this.timeOut;
    } else {
        isEnd = true;
        clown.endTime = nowTime;
        this.addMessage({ name: user.name, sex: user.sex, headurl: user.headurl, win: clown.win });
    }
    data.end = isEnd ? 1 : 0;
    // 查询玩家
    var player = yield this.app.models.Player.findByIdAsync(playerId, 'gold');
    if (player.gold != user.gold) {
        player.gold = user.gold;
        yield player.saveAsync();
    }
    // 冠军玩家
    if (isEnd) {
        yield this.recordRankAsync(user);
    }
    return { code: C.OK, data: data };
});

// 结束选小丑
proto.endChooseAsync = P.coroutine(function* (playerId) {
    // 查找玩家
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.GAME_NOT_IN_GAME };
    }
    // 小丑状态
    var clown = this.clowns[playerId];
    if (!clown) {
        return { code: C.FAILD, msg: C.CLOWN_GAME_OVER };
    }
    var nowTime = Date.now();
    if (clown.star >= this.starCount) {
        return { code: C.FAILD, msg: C.CLOWN_GAME_OVER };
    }
    if (clown.endTime > nowTime) {
        clown.endTime = nowTime;
    }
    // 记录排名
    yield this.recordRankAsync(user);
    return { code: C.OK };
});

// 记录排名
proto.recordRankAsync = P.coroutine(function* (user) {
    if (user.isModified) {
        user.isModified = false;
        var clownPlayer = yield this.app.models.ClownPlayer.findByIdAsync(user.id, 'wWin dWin lastTime');
        if (clownPlayer) {
            clownPlayer.wWin = user.wWin;
            clownPlayer.dWin = user.dWin;
            clownPlayer.lastTime = user.lastTime;
        } else clownPlayer = new this.app.models.ClownPlayer({
            _id: user.id, name: user.name, sex: user.sex,
            headurl: user.headurl, wWin: user.wWin, dWin: user.dWin, lastTime: user.lastTime
        });
        yield clownPlayer.saveAsync();
        var clownInfo = yield this.app.models.ClownInfo.findByIdAsync(this.id, 'maxId maxVal lastTime');
        if (clownInfo) {
            let today = new Date();
            today.setHours(0);
            today.setMinutes(0);
            today.setSeconds(0);
            today.setMilliseconds(0);
            if (clownInfo.lastTime < today.getTime() || user.dWin > clownInfo.maxVal) {
                let maxId = clownInfo.maxId;
                clownInfo.maxId = user.id;
                clownInfo.maxVal = user.dWin;
                clownInfo.lastTime = user.lastTime;
                yield clownInfo.saveAsync();
                if (maxId != user.id) return this.notifyAllAsync('clown_event', { type: 1, data: { account: user.account, name: user.name, sex: user.sex, headurl: user.headurl } });
            }
        }
    }
});

// 红包算法
proto.shuffle = function (total, count) {
    var array = [];
    var _total = total;
    for (let i = 0; i < count; ++i) {
        let last = count - i;
        if (last <= 1) {
            array.push(_total);
        }
        else {
            let t = _.random(1, _total - last + 1);
            array.push(t);
            _total -= t;
        }
    }
    return _.shuffle(array);
};

// 发红包
proto.redPackAsync = P.coroutine(function* (playerId, total, count) {
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.GAME_NOT_IN_GAME };
    }
    if (user.gold < total) {
        return { code: C.FAILD, msg: C.GAME_UNENOUGH_REDPACK };
    }
    user.gold -= total;
    // 查询玩家
    var player = yield this.app.models.Player.findByIdAsync(playerId, 'gold');
    if (player.gold != user.gold) {
        player.gold = user.gold;
        yield player.saveAsync();
    }
    var redpack = new this.app.models.RedPack({
        _id: uuid.v1(),
        uid: playerId,
        gid: this.id,
        total: total,
        count: count,
        golds: this.shuffle(total, count)
    });
    yield redpack.saveAsync();

    process.nextTick(() => {
        var push = this.app.controllers.push;
        return push.broadcastAsync('redpack', { rid: redpack._id, name: user.name, total: String(redpack.total) });
    });
    return { code: C.OK };
});

