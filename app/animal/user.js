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
        { _id: 1, typeId: 0, mul: 2, bet: 0 },			// 鸟类
        { _id: 2, typeId: 0, mul: 24, bet: 0 },			// 银鲨
        { _id: 3, typeId: 0, mul: 48, bet: 0 },			// 金鲨
        { _id: 4, typeId: 0, mul: 2, bet: 0 },			// 兽类
        { _id: 5, typeId: 1, mul: 6, bet: 0 },			// 鸟1
        { _id: 6, typeId: 1, mul: 8, bet: 0 },			// 鸟2
        { _id: 7, typeId: 1, mul: 8, bet: 0 },			// 鸟3
        { _id: 8, typeId: 1, mul: 12, bet: 0 },			// 鸟4
        { _id: 9, typeId: 4, mul: 12, bet: 0 },			// 兽1
        { _id: 10, typeId: 4, mul: 8, bet: 0 },			// 兽2
        { _id: 11, typeId: 4, mul: 8, bet: 0 },			// 兽3
        { _id: 12, typeId: 4, mul: 6, bet: 0 }			// 兽4
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

