'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var _ = require('lodash');
var C = require('../../share/constant');
var logger = quick.logger.getLogger('user', __filename);


// 构造方法
var User = function (game, player) {
    this.app = game.app;
    this.game = game;

    this.id = player._id;
    this.account = player.account;
    this.name = player.name;
    this.sex = player.sex;
    this.headurl = player.headurl;
    this.gold = player.gold;
    this.vip = player.vip;
    this.connectorId = player.connectorId;

    this.wWin = 0;
    this.dWin = 0;
    this.lastTime = 0;
    this.isModified = false;
    this.wateRate = game.wateRate;
};

// 导出类
module.exports = User;

// 原型对象
var proto = User.prototype;

// 重置排名
proto.resetRank = function () {
    var nowTime = Date.now();
    var today = new Date(nowTime);
    today.setHours(0);
    today.setMinutes(0);
    today.setSeconds(0);
    today.setMilliseconds(0);
    var day = today.getDay();
    var sunday = new Date(today.getTime() - day * 86400000);
    if (this.lastTime < today.getTime()) this.dWin = 0;
    if (this.lastTime < sunday.getTime()) this.wWin = 0;
    this.lastTime = nowTime;
    this.isModified = true;
};

