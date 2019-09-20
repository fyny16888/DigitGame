'use strict';
/**
 * 本方法为poke牌类的通用方法类暂时有niuniu golden
 */
var quick = require('quick-pomelo');
var P = quick.Promise;
var util = require('util');
var _ = require('lodash');
var uuid = require('node-uuid');
var C = require('../../share/constant');
var H = require('../../share/const').TASK_TYPE;

// 构造方法
var Controller = function (app) {
    this.app = app;
    this.totalBets = { list: [], lastTime: 0 };
    this.STATE = { FREE: 1, BETTING: 2, OPENING: 3 };
    this.state = this.STATE.FREE;
    this.GAMEEVENT = { 'startBet': 0, 'stopBet': 1, 'result': 2, 'changebanker': 3, 'downSeat': 4, 'leave': 5, 'globalEnd': 6, 'upBanker': 7, 'downBanker': 8 };
    this.users = {};
    this.winners = [];
    this.config = {};
    this.openSecond = 3000;
    this.betSecond = 30000;
    this.id = 0;
    this.GE = '_event';
    this.cn = 0;
    this.logger = -1;
    this.pushStr = 'g:';
    this.name = '';
    this.rpc = '';
    this.downBets = [];
    this.muls = [];
    this.chatTimes = {};
    // 游戏当前信息内存简存
    this.sampleInfo = {
        update: false,
        bankers: [],
        bankersFull: false,
        banker: '0'
    };
    // 同步下注定时器
    this.betsInterval = null;
};


module.exports = Controller;

// 原型对象
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
    let player = yield this.app.models.Player.findByIdReadOnlyAsync(user.id, 'connectorId');
    let connectorId = (player && player.connectorId) || '';
    let channelId = this.pushStr + this.id;
    yield this.app.controllers.push.joinAsync(channelId, user.id, connectorId);
    var mainServer = this.app.getServersByType(this.name)[0];
    if (this.app.getServerId() != mainServer.id) {
        let gameRemote = eval('this.app.rpc.' + this.rpc);
        return gameRemote.joinChannel.toServer(mainServer.id, channelId, user.id, connectorId, () => { });
    }
});

// 加入游戏之后
proto.afterJoinGameAsync = P.coroutine(function* (user) {
    let player = yield this.app.models.Player.findByIdReadOnlyAsync(user.id, 'name vip');
    if (player && player.vip >= 5) {
        yield this.broadcastAsync('0', util.format('3:%d:%d:%d:%s', player.vip, this.id, 1, player.name));
    }
});

// 离开游戏
proto.leaveGameAsync = P.coroutine(function* (playerId) {
    // 查找玩家
    var user = this.users[playerId];
    if (user) {
        yield this.beforeLeaveGameAsync(user);
        this.logger.info('==========leaveGameAsync==%s', playerId);
        this._deleteUser(user);
        yield this.afterLeaveGameAsync(user);
    }
    // 置空游戏
    var player = yield this.app.models.Player.findByIdAsync(playerId, 'gameId gameServerId gold');
    if (player && player.gameServerId) {
        player.gameId = 0;
        player.gameServerId = '';
        if (this.state > this.STATE.FREE && user && user.allBets > 0) {
            player.gold += user.allBets;
        }
        // if (cell) {
        //     let gameInfo = player.gameInfo.id(this.id);
        //     if (gameInfo) {
        //         gameInfo.cell = cell;
        //     }
        // }
        yield player.saveAsync();
    }
    return { code: C.OK };
});

// 离开游戏之前
proto.beforeLeaveGameAsync = P.coroutine(function* (user) {
    let channelId = this.pushStr + this.id;
    var mainServer = this.app.getServersByType(this.name)[0];
    if (this.app.getServerId() != mainServer.id) {
        let gameRemote = eval('this.app.rpc.' + this.rpc);
        return gameRemote.quitChannel.toServer(mainServer.id, channelId, user.id, () => { });
    }
});

// 离开游戏之后
proto.afterLeaveGameAsync = P.coroutine(function* (user) {
    var fb = this.sampleInfo.bankers.indexOf(user.id);
    if (user.downSeat > -1 || user.id == this.sampleInfo.banker || fb != -1) {
        var gameBets = yield this.app.models.GoldenGame.findByIdAsync(this.id);
        var seat = _.find(gameBets.seats, { player: user.id });
        if (seat) {
            seat.player = '0';
            yield this.notifyAllAsync(this.GE, { type: this.GAMEEVENT.leave, seat: seat._id });
        }
        var z_index = gameBets.bankers.indexOf(user.id);
        if (z_index != -1) {
            gameBets.bankers.splice(z_index, 1);
        }
        if (gameBets.banker == user.id) {
            gameBets.bankCount = 0;
        }
        return gameBets.saveAsync();
    }
    return;
});
// 加入游戏
proto.joinGameAsync = P.coroutine(function* (playerId) {
    // 已在游戏中
    if (this.users[playerId]) {
        return {
            code: C.FAILD,
            msg: C.GAME_HAS_ALREADY
        };
    }
    var player = yield this.app.models.Player.findByIdAsync(playerId);
    if (player.gameServerId != '') {
        return { code: C.FAILD, msg: C.GAME_HAS_ALREADY };
    }
    // 创建玩家
    var user = this._createUser(playerId);
    // 抽水比例
    var wateRate = player.wateRate;
    var wateInvalid = player.wateInvalid;
    if ((wateInvalid > Date.now() || wateInvalid == -1) && wateRate >= 0 && wateRate < user.wateRate) {
        user.wateRate = wateRate;
    }
    yield this.beforeJoinGameAsync(user);
    this.logger.info('==========joinGameAsync==%s', playerId);
    this._addUser(user);
    yield this.afterJoinGameAsync(user);    
    // 保存游戏
    if (player) {
        player.gameId = this.id;
        player.gameServerId = this.app.getServerId();
        yield player.saveAsync();
    }
    // 游戏信息
    var gameInfo = player.gameInfo.id(this.id);
    var gameBets = yield this.app.models.GoldenGame.findByIdReadOnlyAsync(this.id, 'gift banker startTime bankCount seats');
    var caijin = (gameBets && gameBets.gift) || 0;
    var danzhu = (gameInfo && gameInfo.cell) || 1000;

    var zhuang = { sys: '1' };
    //test data zhuang
    zhuang.nick = 'YAD';
    zhuang.headurl = 'http://123/3/2.png';
    zhuang.sex = '0';
    zhuang.vip = '3';
    zhuang.gold = '10000000';
    zhuang.num = '10';
    if (gameBets.banker != '0') {
        zhuang.sys = '0';
        let player = yield this.app.models.Player.findByIdReadOnlyAsync(gameBets.banker, 'name headurl gold vip');
        if (player) {
            zhuang.nick = player.name;
            zhuang.gold = player.gold;
            zhuang.vip = player.vip;
            zhuang.headurl = player.headurl;
            zhuang.num = String(gameBets.bankCount);
        }
    }
    var seats = [];
    if (gameBets.seats) {
        for (let s of gameBets.seats) {
            if (s.player != '0') {
                var s_player = yield this.app.models.Player.findByIdReadOnlyAsync(s.player, 'vip headurl name');
                seats.push({ seat: s._id, name: s_player.name, headurl: s_player.headurl, vip: s_player.vip });
            }
        }
    }
    var time = Math.floor((this.betSecond - (Date.now() - gameBets.startTime)) / 1000);
    return {
        code: C.OK,
        data: {
            zhuang: zhuang,
            limitGold: this.config.min_gold,
            limitVip: this.config.min_vip,
            danzhu: String(danzhu),
            caijin: String(caijin),
            time: String(time),
            rate: user.wateRate,
            seats: seats,
            state: String(this.state)
        }
    };
});
proto.startGameAsync = P.coroutine(function* (gameConfig) {
    // 清空下注
    var users = this.users;
    this.config = gameConfig;
    for (let i in users) {
        users[i].resetBet();
    }
    // 下注状态
    this.state = this.STATE.BETTING;
    this.winners = [];
    this.betSecond = gameConfig.all_time;
    this.sampleInfo.gameBets = {
        muls: this.muls,
        bets: this.downBets
    };
    // 开盘倒计时
    var subTime = gameConfig.all_time - gameConfig.openSecond;

    this.setOpenTimeout(subTime);
    // 同步DB定时器
    this.betsInterval = setInterval(() => this.bets2DBAsync(), 5000);
    // 开始下注
    return this.notifyAsync(this.GE, { type: this.GAMEEVENT.startBet, time: String(parseInt(subTime / 1000)) });
});
// 开盘倒计时
proto.setOpenTimeout = function (millisecond) {
    var self = this;
    var app = self.app;
    return setTimeout(() => this.stopBetAsync().then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
        .then(() => {
            // 同步DB定时器
            clearInterval(this.betsInterval);
            this.betsInterval = null;
            return this.bets2DBAsync();
        }), millisecond);
};

// 下注同步DB
proto.bets2DBAsync = function () {
    if (this.sampleInfo.update) {
        let self = this;
        let app = self.app;
        let gb = self.sampleInfo.gameBets;
        return app.memdb.goose.transactionAsync(P.coroutine(function* () {
            var gameBets = yield self.app.models.GoldenGame.findByIdAsync(self.id, 'bets');
            if (gameBets) {
                for (let i = 0; i < gb.bets.length; ++i) {
                    gameBets.bets[i].score += gb.bets[i].score;
                    gb.bets[i].score = 0;
                }
                self.sampleInfo.update = false;
                gameBets.markModified('bets');
                return gameBets.saveAsync();
            }
        }), app.getServerId())
            .then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
    }
};

// 通知本进程
proto.notifyAsync = P.coroutine(function* (route, msg) {
    var ids = Object.keys(this.users);
    if (ids.length > 0) {
        return this.pushMsgAsync(ids, route, msg);
    }
});

// 通知本游戏
proto.notifyAllAsync = P.coroutine(function* (route, msg) {
    var mainServer = this.app.getServersByType(this.name)[0];
    if (this.app.getServerId() == mainServer.id) {
        return this.pushMsgAsync(null, route, msg);
    }
    else {
        let gameRemote = eval('this.app.rpc.' + this.rpc);
        return gameRemote.pushAll.toServer(mainServer.id, route, msg, () => { });
    }
});
// 发送消息
proto.pushMsgAsync = P.coroutine(function* (playerIds, route, msg, nextTick) {
    var self = this;
    var app = this.app;
    var doPush = () => {
        var channelId = self.pushStr + self.id;
        return app.controllers.push.pushAsync(channelId, playerIds, route, msg)
            .catch((err) => {
                logger.debug('pushMsgAsync: [%s]', err.message);
            });
    };
    return !nextTick ? doPush() : process.nextTick(() => {
        return P.bind(this)
            .then(() => doPush())
            .then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
    });
});

// 同步下注
proto.getBetsAsync = P.coroutine(function* (playerId) {
    var time = Date.now();
    if (time - this.totalBets.lastTime >= 5000) {
        let gameBets = yield this.app.models.GoldenGame.findByIdReadOnlyAsync(this.id, 'bets');
        this.totalBets.list = gameBets.bets.map(bet => {
            return { id: String(bet._id), score: String(bet.score) };
        });
        this.totalBets.lastTime = time;
    }
    return { code: C.OK, list: this.totalBets.list };
});

proto.downBetAsync = P.coroutine(function* (playerId, gold, seat) {
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.GAME_NOT_IN_GAME };
    }
    var timeCan = user.timeCan();
    if (!timeCan) {
        return { code: C.FAILD, msg: C.GAME_BET_COOL_DOWN };
    }
    var g_i = _.findIndex(this.config.down_bet_arr, function (n) { return n == gold });
    if (gold <= 0 || g_i == -1) {
        return { code: C.FAILD, msg: C.GAME_GOLD_ERROR };
    }
    if (this.state != this.STATE.BETTING) {
        return { code: C.FAILD, msg: C.GAME_NOT_BETING };
    }
    let res = yield P.promisify((betTol, cb) => {
        var betsRemote = eval('this.app.rpc.checker.betsRemote.check' + this.name + 'CanBet');
        return betsRemote.toServer('bets-check-server', betTol, cb);
    })(gold);
    if (!res.can) {
        return { code: C.FAILD, msg: C.GAME_TBET_OVER_LIMIT };
    }
    var gameBets = this.sampleInfo.gameBets;//yield this.app.models.GoldenGame.findByIdAsync(this.id, 'banker muls bets');
    if (playerId == this.sampleInfo.banker) {
        return { code: C.FAILD, msg: C.GAME_BANKER_BET };
    }
    var player = yield this.app.models.Player.findByIdAsync(playerId, 'gold vip');
    if (!player) {
        return { code: C.FAILD, msg: C.PLAYER_NOT_FOUND };
    }
    var max_mul = _.find(gameBets.muls, { '_id': this.cn }).mul;//gameBets.muls.id(this.cn).mul
    if ((player.gold + user.allBets) < max_mul * (user.allBets + gold)) {
        return { code: C.FAILD, msg: C.GAME_GOLD_SMALL };
    }
    var userBet = user.betGold(seat, gold, this.config.max_single_bet, player.vip);
    if (userBet == -1) {
        return { code: C.FAILD, msg: C.GAME_LOW_VIP };
    }
    if (!userBet) {
        return { code: C.FAILD, msg: C.GAME_BET_ID_ERROR };
    }
    var gameBet = _.find(gameBets.bets, { '_id': seat });//gameBets.bets.id(seat)
    gameBet.score += gold;
    player.gold -= gold;
    this.sampleInfo.update = true;
    return player.saveAsync()
        .then(() => ({ code: C.OK }));
});

// 坐上椅子
proto.downSeatAsync = P.coroutine(function* (playerId, seat) {
    var user = this.users[playerId];
    user.downSeat = seat;
    var gamebets = yield this.app.models.GoldenGame.findByIdAsync(this.id, 'banker seats');
    var seats = gamebets.seats.id(seat);
    if (seats && (seats.player != '0' || seats.player == playerId)) return { code: C.FAILD, msg: C.GAME_SEAT_HAS_ONE };
    if (playerId == gamebets.banker) return { code: C.FAILD, msg: C.GAME_BANKER_NOT_SEAT };
    var sea = _.find(gamebets.seats, { player: playerId });
    if (sea) return { code: C.FAILD, msg: C.GAME_HAS_SEAT };
    if (!seats) return { code: C.FAILD, msg: C.GAME_SEAT_NOT_FOUND };
    // TODO 需要加坐椅子的限制比如VIP等级
    var player = yield this.app.models.Player.findByIdReadOnlyAsync(playerId, 'name headurl vip gold');
    if (player.vip < this.config.seat_vip) {
        return { code: C.FAILD, msg: C.HALL_LOW_VIP };
    }
    seats.player = playerId;
    yield gamebets.saveAsync();
    yield this.notifyAllAsync(this.GE, { type: this.GAMEEVENT.downSeat, data: { seat: seat, nick: player.name, headurl: player.headurl, vip: player.vip, gold: player.gold } })
    return { code: C.OK };
});

// 上庄
proto.upBankerAsync = P.coroutine(function* (playerId) {
    if (this.sampleInfo.bankersFull) {
        return { code: C.FAILD, msg: C.GAME_BANKERS_FULL };
    }
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.GAME_NOT_IN_GAME };
    }
    var player = yield this.app.models.Player.findByIdAsync(playerId, 'gold vip priority account');
    if (player.gold < this.config.min_gold) {
        return { code: C.FAILD, msg: C.HALL_NO_ENOUGH_MONEY };
    }
    if (player.vip < this.config.min_vip) {
        return { code: C.FAILD, msg: C.HALL_LOW_VIP };
    }
    var gameBets = yield this.app.models.GoldenGame.findByIdAsync(this.id, 'banker bankers');
    if (gameBets) {
        if (gameBets.banker == playerId) {
            return { code: C.FAILD, msg: C.GAME_ALREADY_BANKER };
        }
        let bankers = gameBets.bankers;
        if (bankers.length >= 20) {
            this.sampleInfo.bankersFull = true;
            return { code: C.FAILD, msg: C.GAME_BANKERS_FULL };
        }
        let i = bankers.indexOf(playerId);
        if (i != -1) {
            return { code: C.FAILD, msg: C.GAME_ALREADY_BANKER };
        }
        let pos = bankers.length + 1;
        if (player.priority > 0) {
            for (let i = 0; i < bankers.length; ++i) {
                let _player = yield this.app.models.Player.findByIdReadOnlyAsync(bankers[i], 'vip priority gold');
                if (_player.priority <= 0 || _player.vip < player.vip) {
                    bankers.splice(i, 0, playerId);
                    pos = i + 1;
                    break;
                }
                else if (_player.vip == player.vip && _player.gold < player.gold) {
                    bankers.splice(i, 0, playerId);
                    pos = i + 1;
                    break;
                }
            }
            if (pos > bankers.length) {
                bankers.push(playerId);
            }
            player.priority -= 1;
            yield player.saveAsync();
        }
        else {
            bankers.push(playerId);
        }
        this.sampleInfo.bankers = bankers;
        yield gameBets.saveAsync();
        yield this.pushMsgAsync(gameBets.bankers, this.GE, { type: this.GAMEEVENT.upBanker, id: playerId, account: player.account, pos: String(pos) });
        return { code: C.OK, pos: String(pos) };
    }
    return { code: C.OK };
});

// 下庄
proto.downBankerAsync = P.coroutine(function* (playerId) {
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.GAME_NOT_IN_GAME };
    }
    var gameBets = yield this.app.models.GoldenGame.findByIdAsync(this.id, 'banker bankers bankerCount');
    if (gameBets) {
        let pos = 0;
        if (gameBets.banker == playerId) {
            gameBets.bankCount = 0;
        }
        else {
            let i = gameBets.bankers.indexOf(playerId);
            if (-1 == i) {
                return { code: C.FAILD, msg: C.GAME_NOT_BANKER };
            }
            gameBets.bankers.splice(i, 1);
            pos = i + 1;
            this.sampleInfo.bankersFull = false;
        }
        this.sampleInfo.bankers = gameBets.bankers;
        yield gameBets.saveAsync();
        let player = yield this.app.models.Player.findByIdReadOnlyAsync(playerId, 'account name');
        if (gameBets.bankers.length > 0) {
            yield this.pushMsgAsync(gameBets.bankers, this.GE, { type: this.GAMEEVENT.downBanker, id: playerId, account: player.account, pos: String(pos) });
        }
    }
    return { code: C.OK };
});

// 获取排庄列表
proto.listBankerAsync = P.coroutine(function* (playerId) {
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.GAME_NOT_IN_GAME };
    }
    var list = [];
    var gameBets = yield this.app.models.GoldenGame.findByIdReadOnlyAsync(this.id);
    if (gameBets) {
        for (let id of gameBets.bankers) {
            let player = yield this.app.models.Player.findByIdReadOnlyAsync(id, 'name sex headurl vip gold');
            if (player) {
                list.push({
                    name: player.name,
                    headurl: player.headurl,
                    sex: player.sex,
                    vip: String(player.vip),
                    gold: String(player.gold)
                });
            }
        }
    }
    return { code: C.OK, list: list }
});

//更换庄家
proto.changeBankerAsync = P.coroutine(function* (bankerId, bankerSeat, pos) {
    if (bankerSeat > -1) yield this.notifyAsync(this.GE, { type: this.GAMEEVENT.leave, seat: bankerSeat });
    var zhuang = {};
    if (bankerId == '0') {
        zhuang.sys = '1';
        //test data zhuang
        zhuang.nick = 'YAD';
        zhuang.headurl = 'http://123/3/2.png';
        zhuang.sex = '0';
        zhuang.vip = '3';
        zhuang.gold = '10000000';
        zhuang.num = '10';
        this.sampleInfo.bankersFull = false;
    } else {
        zhuang.sys = '0';
        var banker = yield this.app.models.Player.findByIdReadOnlyAsync(bankerId, 'gold name account headurl sex vip');
        var gameBets = yield this.app.models.GoldenGame.findByIdAsync(this.id, 'bankCount bankers');
        zhuang.nick = banker.name;
        zhuang.id = bankerId;
        zhuang.pos = String(pos);
        zhuang.account = banker.account;
        zhuang.sex = banker.sex || '0';
        zhuang.vip = banker.vip || '0';
        zhuang.headurl = banker.headurl;
        zhuang.gold = String(banker.gold);
        zhuang.num = String(gameBets.bankCount);
        if (gameBets.bankers.length < 20) {
            this.sampleInfo.bankersFull = false;
        }
        this.sampleInfo.banker = bankerId;
        this.sampleInfo.bankers = gameBets.bankers;
        // yield this.broadcastAsync(null, util.format('2:%d:%d:%d:%s', banker.vip, this.id, 1, banker.name));
    }
    return this.notifyAsync(this.GE, { type: this.GAMEEVENT.changebanker, zhuang: zhuang });
});

//获取游戏记录
proto.getRecordAsync = P.coroutine(function* (playerId) {
    var records = yield this.app.models.GoldenRecord.findByIdReadOnlyAsync(this.id);
    var returnRcs = records.records.slice(0, 10);
    var rr = [];
    for (var i in returnRcs) {
        var result = returnRcs[i].result;
        if (!result) continue;
        var wl_result = [];
        for (var r = 1; r < 5; r++) {
            if (r > 0) {
                var w_index = result.win.indexOf(r);
                if (w_index != -1) wl_result.push(1);
                else wl_result.push(0);
            }
        }
        rr.push(wl_result);
    }
    return { code: C.OK, data: rr };
});

// 结束游戏
proto.endGameAsync = P.coroutine(function* (pokes, bankerWin) {
    // 游戏状态
    this.state = this.STATE.FREE;
    var gameBets = yield this.app.models.GoldenGame.findByIdReadOnlyAsync(this.id);
    if (!gameBets) return { code: C.FAILD };
    var nowBanker = gameBets.banker;
    gameBets.global_obj = gameBets.global_obj || {};
    var wl_result = []; var pp = [];
    for (var r = 0; r < pokes.length; r++) {
        pp.push({ value: pokes[r], type: gameBets.result.types[r], num: gameBets.result.jsa[r] });
        if (r > 0) {
            var w_index = gameBets.result.win.indexOf(r);
            if (w_index != -1) wl_result.push(1);
            else wl_result.push(0);
        }
    }
    // 通知数据
    var data = {
        pokes: pp,
        result: wl_result,
        bankerWin: bankerWin,
        rate: String(this.config.rate)
    };
    //结算
    var winners = []; var losers = [];
    var maxId = '0';
    var maxVal = 0;
    for (var i in this.users) {
        var user = this.users[i];
        if (user && user.id != nowBanker) {
            let win = user.calcWin(gameBets.result);
            if (win > 0) {
                // 抽水
                let real = Math.floor(win * (1 - user.wateRate));
                // let realWin = real - user.allBets;
                if (real > maxVal) {
                    maxVal = real;
                    maxId = user.id;
                }
                winners.push({ id: user.id, gold: real });
                // 彩金池
                gameBets.gift += ((win - real) * this.config.caijin_rate * 100) / 100;
            } else if (win < 0) {
                losers.push({ id: user.id, gold: win });
            }
        }
    }
    gameBets.gift = Math.round(gameBets.gift);
    gameBets.global_obj.winnerCount = gameBets.global_obj.winnerCount || 0;
    gameBets.global_obj.winnerCount += winners.length;
    this.winners = winners;
    // 剩余彩金
    // data.caijin = String(gameBets.gift);
    // 赢最多玩家
    // data.max = null;
    if (maxId != '0') {
        gameBets.global_obj.max_obj = gameBets.global_obj.max_obj || [];
        gameBets.global_obj.max_obj.push({ _id: maxId, gold: maxVal });
        gameBets.markModified('global_obj');
    }

    // 判断爆庄
    data.bomb = '0';
    var taskObj = [];
    if (gameBets.banker != '0') {
        let b_player = yield this.app.models.Player.findByIdReadOnlyAsync(gameBets.banker, 'name gold vip');
        let gold = (b_player && b_player.gold) || 0;
        if (gold <= 0) {
            data.bomb = '1';
            taskObj.push({ ids: [gameBets.banker], key: H.bombbanker });
            // yield this.broadcastAsync(null, util.format('2:%d:%d:%d:%s', b_player.vip, this.id, 3, b_player.name));
        }
    }

    // 保存数据
    yield gameBets.saveAsync();
    var saveArr = winners.concat(losers);
    if (winners.length > 0) {
        taskObj.push({ ids: _.map(winners, function (w) { return w.id }), key: H.win });
    }
    if (saveArr.length > 0) {
        taskObj.push({ ids: _.map(saveArr, function (w) { return w.id }), key: H.playgame });
    }
    if (taskObj.length > 0) {
        for (let t of taskObj) {
            yield this.app.controllers.hall.updateTaskStatusAsync(t.ids, t.key);
        }
    }
    for (let i of losers) {
        var player = yield this.app.models.Player.findByIdAsync(i.id, 'gold');
        if (player) {
            player.gold += i.gold;
            player.gold = (player.gold < 0) ? 0 : player.gold;
            yield player.saveAsync();
        }
    }
    // 开奖结果
    return this.notifyAsync(this.GE, { data: data, type: this.GAMEEVENT.result });
});

//公共数据处理
proto.globalDataDealAsync = P.coroutine(function* (gift) {
    var gameBets = yield this.app.models.GoldenGame.findByIdReadOnlyAsync(this.id);
    var maxs = gameBets.global_obj.max_obj;
    var winners = this.winners;
    var data = {};
    winners.forEach(i => {
        i.gold += gift;
    });
    for (let w of winners) {
        var player = yield this.app.models.Player.findByIdAsync(w.id);
        if (player) {
            player.gold += w.gold;
            yield player.saveAsync();
        }
    }
    // 发彩金
    data.gift = String(gift);
    // 彩金
    data.caijin = String(gameBets.gift);
    data.bankerTotalGold = 0;
    if (gameBets.banker != '0') {
        var banker = yield this.app.models.Player.findByIdReadOnlyAsync(gameBets.banker, 'gold');
        data.bankerTotalGold = banker.gold;
    }
    //找出赢最多玩家
    data.max = null;
    if (maxs && maxs.length > 0) {
        maxs = _.sortBy(maxs, 'gold');
        data.max = { name: '0', gold: String(0), sex: '0', headurl: 'http://1/2/3.png', vip: '3' };
        var max_o = maxs[maxs.length - 1];
        var player = yield this.app.models.Player.findByIdReadOnlyAsync(max_o._id, 'name sex gold headurl vip');
        if (player) {
            data.max.name = player.name;
            data.max.sex = player.sex;
            data.max.vip = player.vip;
            data.max.gold = max_o.gold;
            data.max.headurl = player.headurl;
        }
        yield this.broadcastAsync(null, util.format('1:%d:%d:%d:%s', player.vip, this.id, data.max.gold, player.name));
    }
    return this.notifyAsync(this.GE, { data: data, type: this.GAMEEVENT.globalEnd });
});

// 停止下注
proto.stopBetAsync = P.coroutine(function* () {
    // 封盘状态
    this.state = this.STATE.OPENING;
    // 停止下注
    return this.notifyAsync(this.GE, { type: this.GAMEEVENT.stopBet });
});

// 喇叭广播
proto.broadcastAsync = P.coroutine(function* (playerId, msg) {
    var res = () => ({ code: C.OK });
    var msg = { name: '', msg: msg };
    if (!playerId) {
        return this.notifyAsync('gameChat', msg).then(res);
    }
    if (playerId != '0') {
        let player = yield this.app.models.Player.findByIdReadOnlyAsync(playerId, 'name headurl vip');
        if (player) {
            let now = Date.now();
            let chatTime = this.chatTimes[playerId];
            if (chatTime && now - chatTime < 3000) {
                return { code: C.FAILD, msg: C.GAME_CHAT_TOO_SOON };
            }
            if (player.vip < 1) {
                return { code: C.FAILD, msg: C.GAME_LOW_VIP };
            }
            this.chatTimes[playerId] = now;
            msg.name = player.name;
            msg.headurl = player.headurl;
            msg.vip = String(player.vip);
        }
    }
    return this.notifyAllAsync('gameChat', msg).then(res);
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
    var player = yield this.app.models.Player.findByIdAsync(playerId);
    if (!player) {
        return { code: C.FAILD, msg: C.PLAYER_NOT_FOUND };
    }
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.GAME_NOT_IN_GAME };
    }
    if (user.allBets > 0) {
        return { code: C.FAILD, msg: C.GAME_BET_NOREDPACK };
    }
    var gameBets = yield this.app.models.GoldenGame.findByIdReadOnlyAsync(this.id, 'banker');
    if (gameBets && gameBets.banker == playerId) {
        return { code: C.FAILD, msg: C.GAME_BANKER_NOREDPACK };
    }
    if (player.gold < total) {
        return { code: C.FAILD, msg: C.GAME_UNENOUGH_REDPACK };
    }
    player.gold -= total;
    yield player.saveAsync();

    var redpack = new this.app.models.RedPack({ _id: uuid.v1() });
    redpack.uid = playerId;
    redpack.gid = this.id;
    redpack.total = total;
    redpack.count = count;
    redpack.golds = this.shuffle(total, count);
    yield redpack.saveAsync();

    yield this.broadcastAsync('0', util.format('5:%d:%d:%d:%s', player.vip, this.id, redpack.total, player.name));
    process.nextTick(() => {
        var push = this.app.controllers.push;
        return push.broadcastAsync('redpack', { rid: redpack._id, name: player.name, total: String(redpack.total) });
    });
    return { code: C.OK };
});