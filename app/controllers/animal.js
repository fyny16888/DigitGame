'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var util = require('util');
var _ = require('lodash');
var uuid = require('node-uuid');
var User = require('../animal/user');
var C = require('../../share/constant');
var H = require('../../share/const').TASK_TYPE;
var logger = quick.logger.getLogger('animal', __filename);

// 游戏状态
var STATE = { FREE: 1, BETTING: 2, OPENING: 3 };

// 最大排庄
const BANKSMAX = 20;

// 构造方法
var Controller = function (app) {
    this.app = app;
    this.id = 10001;
    this.startTime = 0;
    this.betSecond = 28000;
    this.openSecond = 3000;
    this.users = {};
    this.state = STATE.FREE;
    // 全局数据
    this.gift = 0;
    this.maxId = '';
    this.maxVal = 0;
    this.svrCount = 0;
    // 配置信息
    this.gameConfig = {
        wateRate: 0.05,
        bankMin: 200000000,
        giftRate: 0.8,
        maxVip: 1,
        maxBet: 10000,
        oneMax: 1000000
    };
    // 排庄已满
    this.banksFull = false;
    // 请求缓存
    this.chatTimes = {};
    this.totalBets = { list: [], lastTime: 0 };
    // 总下注值
    this.gameBets = {
        update: false,
        banker: '0',
        bets: [
            { _id: 1, count: 0, bet: 0 },			// 鸟类
            { _id: 2, count: 0, bet: 0 },			// 银鲨
            { _id: 3, count: 0, bet: 0 },			// 金鲨
            { _id: 4, count: 0, bet: 0 },			// 兽类
            { _id: 5, count: 0, bet: 0 },			// 鸟1
            { _id: 6, count: 0, bet: 0 },			// 鸟2
            { _id: 7, count: 0, bet: 0 },			// 鸟3
            { _id: 8, count: 0, bet: 0 },			// 鸟4
            { _id: 9, count: 0, bet: 0 },			// 兽1
            { _id: 10, count: 0, bet: 0 },			// 兽2
            { _id: 11, count: 0, bet: 0 },			// 兽3
            { _id: 12, count: 0, bet: 0 }			// 兽4
        ]
    };
    // 同步DB定时器
    this.betsInterval = null;
};

// 导出方法
module.exports = function (app) {
    return new Controller(app);
};

// 原型对象
var proto = Controller.prototype;

// 创建玩家
proto._createUser = function (playerId) {
    return new User(this, playerId);
};

// 添加玩家
proto._addUser = function (user) {
    this.users[user.id] = user;
};

// 删除玩家
proto._deleteUser = function (user) {
    if (this.users[user.id]) {
        delete this.users[user.id];
        delete this.chatTimes[user.id];
    }
};

// 发送消息
proto.pushMsgAsync = P.coroutine(function* (playerIds, route, msg, nextTick) {
    var self = this;
    var app = this.app;
    var doPush = () => {
        var channelId = 'g:' + self.id;
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

// 通知本进程
proto.notifyAsync = P.coroutine(function* (route, msg) {
    var ids = Object.keys(this.users);
    if (ids.length > 0) {
        return this.pushMsgAsync(ids, route, msg);
    }
});

// 通知本游戏
proto.notifyAllAsync = P.coroutine(function* (route, msg) {
    var mainServer = this.app.getServersByType('animal')[0];
    if (this.app.getServerId() == mainServer.id) {
        return this.pushMsgAsync(null, route, msg);
    }
    else {
        let animalRemote = this.app.rpc.animal.animalRemote;
        return animalRemote.pushAll.toServer(mainServer.id, route, msg, () => { });
    }
});

// 加入游戏
proto.joinGameAsync = P.coroutine(function* (playerId) {
    // 在游戏中
    if (this.users[playerId]) {
        return { code: C.FAILD, msg: C.GAME_HAS_ALREADY };
    }
    // 查询玩家
    var player = yield this.app.models.Player.findByIdAsync(playerId);
    if (!player) {
        return { code: C.FAILD, msg: C.PLAYER_NOT_FOUND };
    }
    if (player.gameServerId) {
        return { code: C.FAILD, msg: C.GAME_HAS_ALREADY };
    }
    // 抽水比例
    var wateRate = player.wateRate;
    var wateInvalid = player.wateInvalid;
    // 创建玩家
    var user = this._createUser(playerId);
    if ((wateInvalid > Date.now() || wateInvalid == -1) && wateRate >= 0 && wateRate < user.wateRate) {
        user.wateRate = wateRate;
    }
    yield this.beforeJoinGameAsync(user);
    logger.info('==========joinGameAsync==%s', playerId);
    this._addUser(user);
    yield this.afterJoinGameAsync(user);
    // 保存游戏
    player.gameId = this.id;
    player.gameServerId = this.app.getServerId();
    yield player.saveAsync();
    // 游戏信息
    var gameInfo = player.gameInfo.id(this.id);
    var gameBets = yield this.app.models.Gamebets.findByIdReadOnlyAsync(this.id, 'gift banker bankCount recent');
    var caijin = (gameBets && gameBets.gift) || 0;
    var danzhu = (gameInfo && gameInfo.cell) || 1000;
    var zhuang = { sys: '1' };
    if (gameBets.banker != '0') {
        let player = yield this.app.models.Player.findByIdReadOnlyAsync(gameBets.banker, 'name gold vip headurl');
        if (player) {
            zhuang.sys = '0';
            zhuang.nick = player.name;
            zhuang.gold = String(player.gold);
            zhuang.num = String(gameBets.bankCount);
            zhuang.vip = String(player.vip);
            zhuang.headurl = player.headurl;
        }
    }
    // 计算时间
    var time = Math.round(this.betSecond / 1000);
    var state = STATE.BETTING;
    if (this.state > STATE.FREE) {
        state = this.state;
        let openTime = this.startTime + this.betSecond;
        if (this.state == STATE.OPENING) {
            openTime += this.openSecond;
        }
        time = Math.round((openTime - Date.now()) / 1000);
        if (time < 0 || time > Math.round(this.betSecond / 1000)) {
            logger.warn('player enter: %s, state: %d, time: %d.', playerId, state, time);
        }
    }
    return {
        code: C.OK,
        data: {
            zhuang: zhuang,
            danzhu: String(danzhu),
            caijin: String(caijin),
            time: String(time),
            state: String(state),
            recent: gameBets.recent,
            rate: String(user.wateRate)
        }
    };
});

// 加入游戏之前
proto.beforeJoinGameAsync = P.coroutine(function* (user) {
    let player = yield this.app.models.Player.findByIdReadOnlyAsync(user.id, 'connectorId');
    let connectorId = (player && player.connectorId) || '';
    let channelId = 'g:' + this.id;
    yield this.app.controllers.push.joinAsync(channelId, user.id, connectorId);
    var mainServer = this.app.getServersByType('animal')[0];
    if (this.app.getServerId() != mainServer.id) {
        let animalRemote = this.app.rpc.animal.animalRemote;
        return animalRemote.joinChannel.toServer(mainServer.id, channelId, user.id, connectorId, () => { });
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
proto.leaveGameAsync = P.coroutine(function* (playerId, cell) {
    // 查找玩家
    var user = this.users[playerId];
    // 内存离开
    if (user) {
        yield this.beforeLeaveGameAsync(user);
        logger.info('==========leaveGameAsync==%s', playerId);
        this._deleteUser(user);
        yield this.afterLeaveGameAsync(user);
    }
    // 置空游戏
	let backGold = (this.state > STATE.FREE && user && user.totalBet > 0) ? user.totalBet : 0;
	let player = yield this.app.models.Player.findByIdAsync(playerId, 'gameId gameServerId gameInfo gold');
	if (player && player.gameServerId) {
		player.gameId = 0;
		player.gameServerId = '';
		if (backGold > 0) player.gold += backGold;
		if (cell) {
			let gameInfo = player.gameInfo.id(this.id);
			if (gameInfo) {
				gameInfo.cell = cell;
			}
		}
		yield player.saveAsync();
	}
    return { code: C.OK };
});

// 离开游戏之前
proto.beforeLeaveGameAsync = P.coroutine(function* (user) {
    let channelId = 'g:' + this.id;
    yield this.app.controllers.push.quitAsync(channelId, user.id);
    var mainServer = this.app.getServersByType('animal')[0];
    if (this.app.getServerId() != mainServer.id) {
        let animalRemote = this.app.rpc.animal.animalRemote;
        return animalRemote.quitChannel.toServer(mainServer.id, channelId, user.id, () => { });
    }
});

// 离开游戏之后
proto.afterLeaveGameAsync = P.coroutine(function* (user) {
	if (user.state <= User.STATE.PLAYING) {
		return;
	}
    var gameBets = yield this.app.models.Gamebets.findByIdAsync(this.id, 'banker bankers bankCount');
    if (gameBets) {
        let pos = 0;
        let bankers = gameBets.bankers;
        if (gameBets.banker == user.id) {
            gameBets.bankCount = 0;
        }
        else {
            let i = bankers.indexOf(user.id);
            if (-1 != i) {
                bankers.splice(i, 1);
                pos = i + 1;
                this.banksFull = false;
                if (bankers.length == BANKSMAX - 1) {
                    this.changeBanksNotFull(true);
                }
            }
        }
        if (gameBets.isModified()) {
            yield gameBets.saveAsync();
            if (pos > 0 && bankers.length > 0) {
                let player = yield this.app.models.Player.findByIdReadOnlyAsync(user.id, 'account');
                if (player) {
                    return this.pushMsgAsync(bankers, 'downBanker', { account: player.account, pos: String(pos) });
                }
            }
        }
    }
});

// 配置游戏
proto.configGameAsync = P.coroutine(function* (gameConfig) {
    for (let at in this.gameConfig) {
        if (gameConfig[at]) {
            this.gameConfig[at] = gameConfig[at];
        }
    }
});

// 开始游戏
proto.startGameAsync = P.coroutine(function* (startTime) {
    // 清空下注
    var users = this.users;
    for (let i in users) {
        users[i].resetBet();
    }
    // 下注时间
    this.startTime = startTime;
    // 下注状态
    this.state = STATE.BETTING;
    // 计算时间
    var nowTime = Date.now();
    var openTime = this.startTime + this.betSecond;
    // 开盘倒计时
    this.setOpenTimeout(openTime - nowTime);
    // 同步DB定时器
    this.betsInterval = setInterval(() => this.bets2DBAsync(), 5000);
    // 通知开始下注
    return this.notifyAsync('startBet', { time: String(Math.round((openTime - nowTime) / 1000)) });
});

// 开盘倒计时
proto.setOpenTimeout = function (millisecond) {
    var app = this.app;
    return setTimeout(() => this.stopBetAsync().then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'))
    .then(() => {
        // 同步DB定时器
        clearInterval(this.betsInterval);
        this.betsInterval = null;
        return this.bets2DBAsync();
    }), millisecond);
};

// 停止下注
proto.stopBetAsync = P.coroutine(function* () {
    // 封盘状态
    this.state = STATE.OPENING;
    // 通知停止下注
    return this.notifyAsync('stopBet');
});

// 庄家输赢
proto._bankerWin = function (gamebets) {
    var win = 0;
    var ret = _.find(gamebets.bets, { _id: gamebets.result });
    if (ret) {
        let typeBet = _.find(gamebets.bets, { _id: ret.typeId });
        for (let i of gamebets.bets) {
            win += i.bet;
            if (i._id == ret._id) {
                win -= i.bet * i.mul;
            }
            if (typeBet && i._id == typeBet._id) {
                win -= i.bet * i.mul;
            }
        }
    }
    return win;
};

// 结束游戏
proto.endGameAsync = P.coroutine(function* () {
    // 空闲状态
    this.state = STATE.FREE;
    var gameBets = yield this.app.models.Gamebets.findByIdAsync(this.id);

    // 通知数据
    var data = {
        result: String(gameBets.result) // , rate: String(gameBets.rate)
    };
    // 计算结算
    var winners = [];
    var maxId = '';
    var maxVal = 0; var playgames = [];
    for (let i in this.users) {
        let user = this.users[i];
        if (user.isBet || user.id == gameBets.banker) {
            playgames.push(user.id);
        }
        let win = user.calcWin(gameBets.result);
        if (win > 0) {
            // 抽水后
            let real = Math.floor(win * (1 - user.wateRate));
            if (real > maxVal) {
                maxVal = real;
                maxId = user.id;
            }
            winners.push({ id: user.id, gold: real });
            // 彩金池
            gameBets.gift += Math.floor((win - real) * this.gameConfig.giftRate);
        }
    }
    
    // 是否爆庄
    data.bomb = '0';
    // 庄家输赢
    var bankWin = this._bankerWin(gameBets);
    var realWin = bankWin > 0 ? bankWin * this.gameConfig.wateRate : bankWin;
    var taskObj = [];
    if (gameBets.banker != '0') {
        let player = yield this.app.models.Player.findByIdReadOnlyAsync(gameBets.banker, 'name gold vip wateRate wateInvalid');
        if (player) {
            // 是否爆庄
            if (player.gold <= 0) {
                data.bomb = '1';
                taskObj.push({ ids: [gameBets.banker], key: H.bombbanker });
                // yield this.broadcastAsync(null, util.format('2:%d:%d:%d:%s', player.vip, this.id, 3, player.name));
            }
            // 抽水比例
            let wateRate = player.wateRate;
            let wateInvalid = player.wateInvalid;
            if ((wateInvalid > Date.now() || wateInvalid == -1) && wateRate >= 0 && wateRate < this.gameConfig.wateRate) {
                realWin = bankWin > 0 ? bankWin * wateRate : bankWin;
            }
        }
    }
    data.bankWin = String(realWin);
    
    if (playgames.length > 0) taskObj.push({ ids: playgames, key: H.playgame });
    if (winners.length > 0) taskObj.push({ ids: _.map(winners, function (w) { return w.id }), key: H.win });
    if (taskObj.length > 0) {
        for (let t of taskObj) {
            yield this.app.controllers.hall.updateTaskStatusAsync(t.ids, t.key);
        }
    }
    // 赠送彩金
    data.gift = '0';
    var present = gameBets.present;
    if (present > 0) {
        winners.forEach(i => { i.gold += present; });
        data.gift = String(present);
    }
    // 保存数据
    yield gameBets.saveAsync();
    for (let i of winners) {
        let player = yield this.app.models.Player.findByIdAsync(i.id, 'gold');
        if (player) {
            player.gold += i.gold;
            yield player.saveAsync();
        }
    }
    // 结算汇总
    var mainServer = this.app.getServersByType('animal')[0];
    if (this.app.getServerId() == mainServer.id) {
        yield this.collectResultAsync(maxId, maxVal, gameBets.gift);
    }
    else {
        let animalRemote = this.app.rpc.animal.animalRemote;
        animalRemote.collectResult.toServer(mainServer.id, maxId, maxVal, gameBets.gift, () => { });
    }
    // 清空限制
    if (this.app.getServerId() == mainServer.id) {
        yield P.promisify((cb) => {
            var betsRemote = this.app.rpc.checker.betsRemote;
            return betsRemote.resetAnimal.toServer('bets-check-server', cb);
        })();
    }
    // 开奖结果
    return this.notifyAsync('result', data);
});

// 切换庄家
proto.changeBankerAsync = P.coroutine(function* (banker, bankCount, pos) {
	var oldBanker = this.gameBets.banker;
    if (oldBanker != '0') {
		let user = this.users[oldBanker];
		if (user && user.state == User.STATE.BANKING) {
			user.state = User.STATE.PLAYING;
		}
    }
    this.banksFull = false;
    this.gameBets.banker = banker;
    var data = { account: '0' };
    if (banker != '0') {
		let user = this.users[banker];
		if (user && user.state == User.STATE.WILLBANK) {
			user.state = User.STATE.BANKING;
		}
        let player = yield this.app.models.Player.findByIdReadOnlyAsync(banker, 'account name headurl gold vip');
        if (player) {
            data.account = player.account;
            data.pos = String(pos);
            data.name = player.name;
            data.headurl = player.headurl;
            data.vip = String(player.vip);
            data.gold = String(player.gold);
            data.count = String(bankCount);
            // yield this.broadcastAsync(null, util.format('2:%d:%d:%d:%s', player.vip, this.id, 1, player.name));
        }
    }
    return this.notifyAsync('changeBanker', data);
});

// 同步下注
proto.getBetsAsync = P.coroutine(function* (playerId) {
    var time = Date.now();
    if (time - this.totalBets.lastTime >= 5000) {
        let gameBets = yield this.app.models.Gamebets.findByIdReadOnlyAsync(this.id, 'bets');
        this.totalBets.list = gameBets.bets.map(bet => {
            return { id: String(bet._id), bet: String(bet.bet) };
        });
        this.totalBets.lastTime = time;
    }
    return { code: C.OK, list: this.totalBets.list };
});

// 下注同步DB
proto.bets2DBAsync = function () {
    if (this.gameBets.update) {
        let self = this;
        let app = self.app;
        return app.memdb.goose.transactionAsync(P.coroutine(function* () {
            var gameBets = yield self.app.models.Gamebets.findByIdAsync(self.id, 'bets');
            if (gameBets) {
                for (let i = 0; i < self.gameBets.bets.length; ++i) {
                    gameBets.bets[i].bet += self.gameBets.bets[i].bet;
                    self.gameBets.bets[i].bet = 0;
                    gameBets.bets[i].count += self.gameBets.bets[i].count;
                    self.gameBets.bets[i].count = 0;
                }
                self.gameBets.update = false;
                gameBets.markModified('bets');
                return gameBets.saveAsync();
            }
        }), app.getServerId())
            .then(() => app.event.emit('transactionSuccess'), () => app.event.emit('transactionFail'));
    }
};

// 下注金币
proto.betGoldAsync = P.coroutine(function* (playerId, bets) {
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.GAME_NOT_IN_GAME };
    }
    if (this.state != STATE.BETTING) {
        return { code: C.FAILD, msg: C.GAME_NOT_BETING };
    }
    var lastTime = Date.now();
    if (lastTime - user.lastTime < 200) {
        return { code: C.FAILD, msg: C.GAME_BET_COOL_DOWN };
    }
    if (bets.length > 90) {
        return { code: C.FAILD, msg: C.GAME_PARAM_ERROR };
    }
    var player = yield this.app.models.Player.findByIdAsync(playerId, 'vip gold');
    if (!player) {
        return { code: C.FAILD, msg: C.PLAYER_NOT_FOUND };
    }
    var gameBets = this.gameBets;
    if (playerId == gameBets.banker) {
        return { code: C.FAILD, msg: C.GAME_BANKER_BET };
    }
    const NUMBERS = { '1000': 1000, '10000': 10000, '100000': 100000, '500000': 500000, '1000000': 1000000, '5000000': 5000000 };//, '10000000': 10000000
    var ttBet = 0, vbets = [];
    for (let bet of bets) {
        let betId = Number(bet.betId);
        let userBet = user.findBet(betId);
        if (!userBet) {
            return { code: C.FAILD, msg: C.GAME_BET_ID_ERROR };
        }
        let gold = Number(bet.gold);
        if (!gold || gold <= 0) {
            return { code: C.FAILD, msg: C.GAME_GOLD_ERROR };
        }
        if (!NUMBERS[gold]) {
            return { code: C.FAILD, msg: C.GAME_GOLD_ERROR };
        }
        let vgold = gold;
        let vbet = _.find(vbets, { id: betId });
        if (vbet) {
            vgold += vbet.gold;
            if ((player.vip || 0) < this.gameConfig.maxVip && userBet.bet + vgold > this.gameConfig.oneMax) {
                return { code: C.FAILD, msg: C.GAME_LOW_VIP };
            }
            vbet.gold += gold;
        } else {
            vbets.push({ id: betId, gold: gold, bet: userBet });
        }
        ttBet += gold;
    }
    if (user.totalBet + ttBet > 5000000000) {
        return { code: C.FAILD, msg: C.GAME_PARAM_ERROR };
    }
    if (player.gold < ttBet) {
        return { code: C.FAILD, msg: C.GAME_GOLD_SMALL };
    }
    if (vbets.length > 0) {
        let res = yield P.promisify((betTol, cb) => {
            var betsRemote = this.app.rpc.checker.betsRemote;
            return betsRemote.checkAnimCanBet.toServer('bets-check-server', betTol, cb);
        })(ttBet);
        if (!res.can) {
            return { code: C.FAILD, msg: C.GAME_TBET_OVER_LIMIT };
        }
        for (let vbet of vbets) {
            let betId = vbet.id;
            let gold = vbet.gold;
            let userBet = vbet.bet;
            user.betGold(userBet, gold);
            let gameBet = _.find(gameBets.bets, { _id: betId });
            if (userBet.bet <= gold) {
                gameBet.count += 1;
            }
            player.gold -= gold;
            gameBet.bet += gold;
        }
        user.lastTime = lastTime;
        gameBets.update = true;
        yield player.saveAsync();
    }
    return { code: C.OK };
});

// 上庄请求
proto.upToBankerAsync = P.coroutine(function* (playerId) {
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.GAME_NOT_IN_GAME };
    }
    if (user.state > User.STATE.PLAYING) {
		return { code: C.FAILD, msg: C.GAME_ALREADY_BANKER };
    }
    if (this.banksFull) {
        return { code: C.FAILD, msg: C.GAME_BANKERS_FULL };
    }
    var player = yield this.app.models.Player.findByIdAsync(playerId, 'account vip gold priority');
    if (!player) {
        return { code: C.FAILD, msg: C.PLAYER_NOT_FOUND };
    }
    if (player.vip < 1) {
        return { code: C.FAILD, msg: C.GAME_LOW_VIP };
    }
    if (player.gold < this.gameConfig.bankMin) {
        return { code: C.FAILD, msg: C.GAME_GOLD_SMALL };
    }
    var gameBets = yield this.app.models.Gamebets.findByIdAsync(this.id, 'banker bankers');
    if (gameBets) {
        if (gameBets.banker == playerId) {
            return { code: C.FAILD, msg: C.GAME_ALREADY_BANKER };
        }
        let bankers = gameBets.bankers;
        if (bankers.length >= BANKSMAX) {
            this.banksFull = true;
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
        user.state = User.STATE.WILLBANK;
        yield gameBets.saveAsync();
        yield this.pushMsgAsync(gameBets.bankers, 'upBanker', { account: player.account, pos: String(pos) });
    }
    return { code: C.OK, priority: String(player.priority) };
});

// 下庄请求
proto.downBankerAsync = P.coroutine(function* (playerId) {
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.GAME_NOT_IN_GAME };
    }
    if (user.state <= User.STATE.PLAYING) {
		return { code: C.FAILD, msg: C.GAME_NOT_BANKER };
    }
    var gameBets = yield this.app.models.Gamebets.findByIdAsync(this.id, 'banker bankers bankCount');
    if (gameBets) {
        let pos = 0;
        let bankers = gameBets.bankers;
        if (gameBets.banker == playerId) {
            if (gameBets.bankCount <= 0) {
                return { code: C.FAILD, msg: C.GAME_NEXT_NOBANKER };
            }
            gameBets.bankCount = 0;
        }
        else {
            let i = bankers.indexOf(playerId);
            if (-1 == i) {
                return { code: C.FAILD, msg: C.GAME_NOT_BANKER };
            }
            bankers.splice(i, 1);
            pos = i + 1;
            this.banksFull = false;
            if (bankers.length == BANKSMAX - 1) {
                this.changeBanksNotFull(true);
            }
        }
        user.state = User.STATE.PLAYING;
        yield gameBets.saveAsync();
        let player = yield this.app.models.Player.findByIdReadOnlyAsync(playerId, 'account');
        if (pos > 0 && bankers.length > 0) {
            yield this.pushMsgAsync(bankers, 'downBanker', { account: player.account, pos: String(pos) });
        }
    }
    return { code: C.OK };
});

// 排庄变为未满
proto.changeBanksNotFull = function (orRpc) {
    this.banksFull = false;
    if (orRpc) {
        let serverId = this.app.getServerId();
        let gameServers = this.app.getServersByType('animal');
		let animalRemote = this.app.rpc.animal.animalRemote;
        for (let i = 0; i < gameServers.length; ++i) {
            if (gameServers[i].id == serverId) continue;
            animalRemote.changeBanksNotFull.toServer(gameServers[i].id, false, () => {});
        }
    }
};

// 获取排庄列表
proto.listBankerAsync = P.coroutine(function* (playerId) {
    var user = this.users[playerId];
    if (!user) {
        return { code: C.FAILD, msg: C.GAME_NOT_IN_GAME };
    }
    var list = [];
    var gameBets = yield this.app.models.Gamebets.findByIdReadOnlyAsync(this.id, 'bankers');
    if (gameBets) {
        for (let id of gameBets.bankers) {
            let player = yield this.app.models.Player.findByIdReadOnlyAsync(id, 'name headurl vip gold');
            if (player) {
                list.push({
                    name: player.name,
                    headurl: player.headurl,
                    vip: String(player.vip),
                    gold: String(player.gold)
                });
            }
        }
    }
    return { code: C.OK, list: list };
});

// 结算汇总
proto.collectResultAsync = P.coroutine(function* (maxId, maxVal, gift) {
    this.svrCount += 1;
    if (maxVal > this.maxVal) {
        this.maxId = maxId;
        this.maxVal = maxVal;
    }
    if (gift > this.gift) {
        this.gift = gift;
    }
    var gameServers = this.app.getServersByType('animal');
    if (this.svrCount >= gameServers.length) {
        var data = {
            caijin: String(this.gift),
            max: { name: '', value: String(this.maxVal) }
        }
        if (this.maxId) {
            let player = yield this.app.models.Player.findByIdReadOnlyAsync(this.maxId, 'name headurl vip');
            if (player) {
                data.max.name = player.name;
                data.max.headurl = player.headurl;
                
                let msg = util.format('1:%d:%d:%d:%s', player.vip, this.id, this.maxVal, player.name);
                yield this.broadcastAsync('0', msg);
                if (this.maxVal >= 1000000000) {
                    yield this.app.controllers.hall.broadcastAsync(null, msg);
                }
            }
        }
        return this.notifyAllAsync('collect', data)
            .then(() => {
                this.gift = 0;
                this.maxId = '';
                this.maxVal = 0;
                this.svrCount = 0;
            });
    }
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
    if (user.isBet) {
        return { code: C.FAILD, msg: C.GAME_BET_NOREDPACK };
    }
    var gameBets = yield this.app.models.Gamebets.findByIdReadOnlyAsync(this.id, 'banker');
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

