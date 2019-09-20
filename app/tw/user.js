'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var C = require('../../share/constant');
var logger = quick.logger.getLogger('user', __filename);

// 玩家状态
var STATE = { FREE: 1, READY: 2, PLAYING: 3, FAILED: 4 };

// 构造方法
var User = function (game, id, table) {
    this.game = game;
    this.name = '';
    this.id = id;
    this.table = table;
    this.bet_score = 1;
    this.isSee = false;
    this.schedule = -1;
    this.poke = -1;
    this.win = false;
    this.compareStatus=false;
    this.state = STATE.FREE;
    this.chairId = -1;
    this.score = 1000;
};

// 导出状态
User.STATE = STATE;

// 导出类
module.exports = User;

// 原型对象
var proto = User.prototype;

// 是否准备
proto.isReady = function () {
    return this.state == STATE.READY;
};

// 是否准备compare
proto.isCompare = function () {
    return !!this.compareStatus;
};

// 是否桌主
proto.isOwner = function () {
    console.log();
    return this.id == this.table.ownerId;
};

// 看牌
proto.seePoke = function () {
    this.isSee = true;
};

// 下分
proto.addBet = function (score) {
    this.bet_score += score;
    this.table.totalScore += score;
};


proto.defaultRound = function(){
    this.bet_score = 1;
    this.isSee = false;
    this.poke = -1;
    this.win = false;
    this.compareStatus=false;
    this.state = STATE.FREE;
    this.score = 1000;
};