'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var User = require('../to/user');
var util = require('util');
var _ = require('lodash');
var C = require('../../share/constant');
var logger = quick.logger.getLogger('to', __filename);

// 构造方法
var Controller = function (app) {
    this.id = 10004;
    this.app = app;
    this.users = {};
    this.maxTimes = 10;
    this.paichi = [];
    this.channels = [[], [], [], []];
    this.channelScore = [0, 0, 0, 0];
    this.prePoke = -1;

    // this.pushStr = 'g:';
};

// 导出方法
module.exports = function (app) {
    return new Controller(app);
};

var proto = Controller.prototype;
var cor = P.coroutine;


// 添加玩家
proto._addUser = function (user) {
    this.users[user.id] = user;
};
// 创建玩家
proto._createUser = function (playerId) {
    return new User(this, playerId);
};
// 删除玩家
proto._deleteUser = function (user) {
    if (this.users[user.id]) {
        delete this.users[user.id];
    }
};
// 加入游戏之前
proto.beforeJoinGameAsync = P.coroutine(function* (user) {
    // let player = yield this.app.models.Player.findByIdReadOnlyAsync(user.id, 'connectorId');
    // let connectorId = (player && player.connectorId) || '';
    // let channelId = this.pushStr + this.id;
    // return this.app.controllers.push.joinAsync(channelId, user.id, connectorId);
});

// 加入游戏之后
proto.afterJoinGameAsync = P.coroutine(function* (user) {

});

// 离开游戏
proto.leaveGameAsync = P.coroutine(function* (playerId) {
    // 查找玩家
    var user = this.users[playerId];
    if (user) {
        yield this.beforeLeaveGameAsync(user);
        logger.info('==========leaveGameAsync==%s', playerId);
        this._deleteUser(user);
        yield this.afterLeaveGameAsync(user);
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

// 离开游戏之前
proto.beforeLeaveGameAsync = P.coroutine(function* (user) {
    // let channelId = this.pushStr + this.id;
    // return this.app.controllers.push.quitAsync(channelId, user.id);
});

// 离开游戏之后
proto.afterLeaveGameAsync = P.coroutine(function* (user) {
    return this.completeGameAsync(user);
});

// 加入游戏
proto.joinGameAsync = P.coroutine(function* (playerId, pokeValue) {
    // 已在游戏中  100   1     10000   10     100000  50
    // pokeValue = pokeValue || 100;
    // var pvs = [100, 10000, 100000];
    // var pbs = { 100: 1, 10000: 10, 100000: 50 };
    if (this.users[playerId]) {
        return {
            code: C.FAILD,
            msg: C.GAME_HAS_ALREADY
        };
    }
    // if (_.findIndex(pvs, function (n) { return n == Number(pokeValue) }) == -1) {
    //     return { code: C.FAILD, msg: C.GAME_GOLD_ERROR }
    // }
    var player = yield this.app.models.Player.findByIdAsync(playerId, 'toTimes gameId gameServerId toScore');
    if (player.gameServerId != '') {
        return { code: C.FAILD, msg: C.GAME_HAS_ALREADY };
    }
    if (typeof player.toTimes == 'undefined') player.toTimes = this.maxTimes;
    // if ((player.toTimes - 1) < 0) {
    //     return { code: C.FAILD, msg: C.GAME_HAVE_NO_TIMES };
    // }
    var nowTime = formatTime();
    var selfRecord = yield this.app.models.TORecord.findByIdAsync(playerId + nowTime);
    if (!selfRecord) {
        player.toTimes = this.maxTimes;
    }
    // 创建玩家
    var user = this._createUser(playerId);
    yield this.beforeJoinGameAsync(user);
    logger.info('==========joinGameAsync==%s', playerId);
    this._addUser(user);
    yield this.afterJoinGameAsync(user);
    // 保存游戏    
    if (player) {
        player.gameId = this.id;
        player.gameServerId = this.app.getServerId();
        user.score = player.toScore || 0;
        yield player.saveAsync();
    }
    return { code: C.OK, data: { cur: player.toTimes, max: this.maxTimes, toScore: (selfRecord && selfRecord.score) || 0 } };
});

proto.changeCallPoke = cor(function* (playerId, pokeValue) {
    var user = this.users[playerId];
    if (user.callPokeGold != 0) {
        return { code: C.FAILD, msg: C.TABLE_SCORE_CHANGED };
    }
    pokeValue = pokeValue || 1000;
    var pvs = [1000, 10000, 100000];
    var pbs = { 1000: 1, 10000: 5, 100000: 10 };
    if (_.findIndex(pvs, function (n) { return n == Number(pokeValue) }) == -1) {
        return { code: C.FAILD, msg: C.GAME_GOLD_ERROR }
    }
    user.callPokeGold = Number(pokeValue);
    user.toBet = pbs[pokeValue];
    return { code: C.OK };
});

//重新开始
proto.againGameAsync = cor(function* (playerId) {
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.GAME_NOT_IN_GAME };
    }
    var player = yield this.app.models.Player.findByIdAsync(playerId, 'toTimes');
    if (typeof player.toTimes == 'undefined') player.toTimes = this.maxTimes;
    if ((player.toTimes - 1) < 0) {
        return { code: C.FAILD, msg: C.GAME_TO_NO_TIMES };
    }
    player.toTimes -= 1;
    yield player.saveAsync();
    return this.beginGame(user);
});

// 开始游戏
proto.beginGameAsync = cor(function* (playerId) {
    var user = this.users[playerId];
    if (user.callPokeGold == 0) {
        user.callPokeGold = 100;
        user.toBet = 1;
    }
    var player = yield this.app.models.Player.findByIdAsync(playerId, 'toTimes');
    if ((player.toTimes - 1) < 0) {
        return { code: C.FAILD, msg: C.GAME_TO_NO_TIMES };
    }
    player.toTimes -= 1;
    yield player.saveAsync();
    user.paichi = getAllPoke();
    let ind = parseInt(Math.random() * 51);
    var rc = user.paichi[ind];
    user.paichi.splice(ind, 1);
    user.prePoke = rc;
    return { code: C.OK, data: { cur: player.toTimes, max: this.maxTimes, poke: rc, count: user.paichi.length } };
});

var getAllPoke = function () {
    let allPokes = [];
    for (var i = 1; i < 5; i++) {
        for (var j = 1; j < 14; j++) {
            allPokes.push(i * 100 + j);
        }
    }
    return allPokes;
};

// 点击渠道
proto.getCardAsync = cor(function* (playerId, channel) {
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.GAME_NOT_IN_GAME };
    }
    var player = yield this.app.models.Player.findByIdAsync(playerId, 'gold');
    if (player.gold - user.callPokeGold < 0) {
        // return { code: C.FAILD, msg: C.GAME_GOLD_SMALL };
        return this.completeGameAsync(user, 'error');
    }
    player.gold -= user.callPokeGold;
    yield player.saveAsync();
    user.channels[channel].push(user.prePoke);
    var pokes = _.map(user.channels[channel], function (n) { return n % 100; });
    var totalCount = 0; var boom = 0;
    var h_o = _.findIndex(pokes, function (n) { return n == 1 });
    if (h_o != -1) {
        for (let p of pokes) {
            totalCount += (p >= 10 ? 10 : p);
        }
        if (totalCount > 21) {
            boom = 1;
        } else {
            if ((totalCount + 10) <= 21) {
                totalCount += 10;
            }
        }
    } else {
        for (let p of pokes) {
            totalCount += (p >= 10 ? 10 : p);
            if (totalCount > 21) {
                boom = 1;
                break;
            }
        }
    }
    var rcC = 0; var to = false; var winMul = 1; var loseMul = 1;
    if (!boom) {
        if (totalCount == 21) {
            to = true;
            totalCount = 0;
            user.channels[channel] = [];
            user.score += winMul * user.toBet;
        } else {
            rcC = totalCount;
        }
    } else {
        totalCount = 0;
        user.score -= loseMul * user.toBet;
        if (user.score < 0) user.score = 0;
        user.channels[channel] = [];
    }
    user.channelScore[channel] = totalCount;
    if (user.paichi.length == 0) {
        user.paichi = _.shuffle(getAllPoke());
        // return this.completeGameAsync(user);
    }
    let ind = parseInt(Math.random() * user.paichi.length);
    var cScore = user.channelScore;
    var rc = user.paichi[ind];
    if (rc) {
        user.paichi.splice(ind, 1);
        user.prePoke = rc;
    }
    return { code: C.OK, data: { boom: to ? 2 : boom, toScore: user.score, channel: channel, cScore: cScore, poke: rc ? rc : 0, count: user.paichi.length } };
});

var formatTime = function (timestamp) {
    var a = new Date();
    a.setTime(timestamp || Date.now());
    var y = a.getFullYear(), m = a.getMonth() + 1, d = a.getDate();
    return Date.parse([y, m, d].join('-') + ' 00:00:00');
};

// 游戏完成
proto.completeGameAsync = cor(function* (user, err) {
    var player = yield this.app.models.Player.findByIdAsync(user.id, 'toScore vip name');
    var changeScore = user.score - player.toScore;
    player.toScore = user.score;
    var nowTime = formatTime();
    var selfRecord = yield this.app.models.TORecord.findByIdAsync(user.id + nowTime);
    if (!selfRecord) {
        selfRecord = new this.app.models.TORecord({ _id: user.id + nowTime, time: nowTime, vip: player.vip, name: player.name, score: 0 });
    }
    selfRecord.score += changeScore;
    yield selfRecord.saveAsync();
    yield player.saveAsync();
    user.initGame();
    if (err) {
        return { code: C.FAILD, msg: C.GAME_GOLD_SMALL };
    }
    return { code: C.OK, data: { toScore: user.score } };
});

// 获取列表
proto.getListAsync = cor(function* (playerId) {
    var nowTime = formatTime(); var data = {}; data.players = [];
    var tors = yield this.app.models.TORecord.findMongoAsync({ score: { $gt: 0 }, time: nowTime }, '_id name vip score', { sort: '-score', limit: 10 });
    var f_i = _.findIndex(tors, function (n) { return n._id == (playerId + nowTime) });
    var pos = 101;
    if (f_i != -1) {
        pos = f_i + 1;
    }
    data.pos = pos;
    data.players = _.map(tors, function (n) { delete n._id; return n; });
    return { code: C.OK, data: data };
});

proto.getWinAsync = cor(function* (playerId) {
    var nowTime = formatTime(); var yesT = nowTime - (60 * 60 * 24 * 1000);
    var tl = 'tolist' + yesT;
    var tolist = yield this.app.models.SingleData.findByIdAsync(tl);
    if (!tolist) {
        var tors = yield this.app.models.TORecord.findMongoAsync({ score: { $gt: 0 }, time: { $gt: yesT, $lt: nowTime } }, '_id score', { sort: '-score', limit: 10 });
        // tors = _.map(tors, function (n) { return n.score });
        tolist = new this.app.models.SingleData({ _id: tl, data: tors });
        tolist.markModified('data');
        yield tolist.saveAsync();
    }
    var sd = yield this.app.models.Selfdraws.findByIdAsync(playerId);
    if (!sd) {
        sd = new this.app.models.Selfdraws({ _id: playerId, total_draw: 0, draws: [] });
    }
    var player = yield this.app.models.Player.findByIdAsync(playerId, 'gold');
    var selfRecord = yield this.app.models.TORecord.findByIdAsync(playerId + yesT);
    if (selfRecord && selfRecord.is_get == 1) {
        //排名奖励配置测试版
        var giftList = [{ gold: 1000000000, note: 10000 }, { gold: 500000000, note: 7000 }, { gold: 200000000, note: 5000 }, { gold: 100000000, note: 3000 }
            , { gold: 80000000, note: 2000 }, { gold: 50000000, note: 1000 }, { gold: 30000000, note: 800 }, { gold: 20000000, note: 500 }
            , { gold: 10000000, note: 300 }, { gold: 5000000, note: 200 }, { gold: 1000000, note: 50 }];
        var gameConfig = yield this.app.models.GameConfig.findByIdAsync(this.id);
        if (!gameConfig) {
            gameConfig = new this.app.models.GameConfig({ _id: this.id, config: { giftList: giftList } });
            gameConfig.markModified('config');
            yield gameConfig.saveAsync();
        }
        giftList = gameConfig.config.giftList;
        var addGift = giftList[10];
        var fi = _.findIndex(tolist.data, function (n) { return n._id == playerId });
        if (fi != -1) {
            addGift = giftList[fi];
        }
        player.gold += addGift.gold;
        sd.total_draw += addGift.note;
        selfRecord.is_get = 2;
        yield player.saveAsync();
        yield sd.saveAsync();
        yield selfRecord.saveAsync();
        return { code: C.OK, win: addGift };
    }
    if (!selfRecord) {
        return { code: C.OK, win: { gold: -2, note: 0 } };
    }
    if (selfRecord && selfRecord.is_get == 2) {
        return { code: C.OK, win: { gold: -1, note: 0 } };
    }
    return { code: C.OK, win: { gold: 0, note: 0 } };
})

proto.configGameAsync = P.coroutine(function* (config) {
    var GameConfig = yield this.app.models.GameConfig.findByIdAsync(this.id);
    GameConfig.config = config;
    GameConfig.markModified('config');
    yield GameConfig.saveAsync();
    // this.config = config;
    return true;
});