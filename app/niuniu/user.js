'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var _ = require('lodash');
var C = require('../../share/constant');
var logger = quick.logger.getLogger('user', __filename);

// 玩家状态
var STATE = { FREE: 1, READY: 2, PLAYING: 3, FAILED: 4 };

// 构造方法
var User = function (game, id) {
    this.game = game;
    this.name = '';
    this.id = id;
    this.downSeat = -1;
    this.downTime=-1;
    this.downBet = [
        { _id: 1, score: 0 },
        { _id: 2, score: 0 },
        { _id: 3, score: 0 },
        { _id: 4, score: 0 }
    ];
    this.allBets = 0;
    this.wateRate = game.config.rate;
};

// 导出状态
User.STATE = STATE;

// 导出类
module.exports = User;

var proto = User.prototype;

// 清空下注
proto.resetBet = function () {
    this.allBets = 0;
    for (let i of this.downBet) {
        i.score = 0;
    }
};

// 下注金币
proto.betGold = function (betId, gold, maxsinglebet, vip) {
    var bet = _.find(this.downBet, { _id: betId });
    if (bet) {
        if (vip == 0) {
            if ((bet.score + gold) > maxsinglebet) return -1;
        }
        bet.score += gold;
        this.allBets += gold;
    }
    return bet;
};

proto.timeCan = function () {
    if (this.downTime == -1) {
        this.downTime = Date.now();
        return true;
    }
    var nowTime = Date.now();
    if ((nowTime - this.downTime) < 1000) {
        return false;
    }
    this.downTime = nowTime;
    return true;
};

// 计算输赢
proto.calcWin = function (result) {
    var fsa = result.jsa;
    var win = result.win;
    var lose = result.lose;
    var bankerMu = fsa[0];
    var ws = 0; var ls = 0;
    for (let w of win) {
        var ret = _.find(this.downBet, { _id: w });
        var mul = fsa[w];
        if (ret) {
            ws += (mul) * ret.score;
        }
    }
    for (let l of lose) {
        var re = _.find(this.downBet, { _id: l });
        if (re) {
            ls += (bankerMu) * re.score;
        }
    }
    return ws - ls;
};