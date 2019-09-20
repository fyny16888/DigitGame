'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var _ = require('lodash');
var C = require('../../share/constant');
var logger = quick.logger.getLogger('user', __filename);

// 状态
const STATE = { PLAYING: 1, WILLBANK: 2, BANKING: 3 };

// 构造方法
var User = function (game, id) {
    this.app = game.app;
    this.game = game;
    this.id = id;
    this.bets = [
        { _id: 1, typeId: 0, mul: 100, bet: 0 },		// 水果1
        { _id: 2, typeId: 0, mul: 50, bet: 0 },			// 水果2
        { _id: 3, typeId: 0, mul: 20, bet: 0 },			// 水果3
        { _id: 4, typeId: 0, mul: 15, bet: 0 },			// 水果4
        { _id: 5, typeId: 0, mul: 8, bet: 0 },			// 水果5
        { _id: 6, typeId: 0, mul: 5, bet: 0 },			// 水果6
        { _id: 7, typeId: 0, mul: 3, bet: 0 },			// 水果7
        { _id: 8, typeId: 0, mul: 2, bet: 0 },			// 水果8
        { _id: 9, typeId: 0, mul: 0, bet: 0 },			// 水果9
    ];
    this.isBet = false;
    this.totalBet = 0;
    this.state = STATE.PLAYING;
    this.wateRate = game.gameConfig.wateRate;
    this.lastTime = 0;
};

// 导出状态
User.STATE = STATE;

// 导出类
module.exports = User;

// 原型对象
var proto = User.prototype;

// 清空下注
proto.resetBet = function () {
    for (let i of this.bets) {
        i.bet = 0;
    }
    this.isBet = false;
    this.totalBet = 0;
};

// 下注金币
proto.betGold = function (bet, gold) {
    bet.bet += gold;
    this.totalBet += gold;
    this.isBet = this.isBet || true;
};

// 计算输赢
proto.calcWin = function (result) {
    var win = 0;
    if (result == 9) {
        for (let i of this.bets) {
            if (i.bet > 0) {
                win += i.bet * i.mul;
            }
        }
        return win;
    }
    var ret = _.find(this.bets, { _id: result });
    if (ret) {
        let typeBet = _.find(this.bets, { _id: ret.typeId });
        for (let i of this.bets) {
            if (i._id == ret._id) {
				win += i.bet * i.mul;
			}
            if (typeBet && i._id == typeBet._id) {
				win += i.bet * i.mul;
			}
        }
    }
    return win;
};

// 查找下注
proto.findBet = function (betId) {
    return _.find(this.bets, { _id: betId });
};

