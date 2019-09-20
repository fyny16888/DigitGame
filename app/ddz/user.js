'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var C = require('../../share/constant');
var logger = quick.logger.getLogger('user', __filename);

// 玩家状态
var STATE = { FREE: 1, READY: 2, PLAYING: 3 };

// 构造方法
var User = function (game, id, table) {
    this.game = game;
    this.id = id;
    this.table = table;

    this.state = STATE.READY;
    this.chairId = -1;
    //确定地主叫分
    this.jiaofen = -1;
    //明牌
    this.seePoke = false;
    //玩家出牌记录
    this.record = [];
    this.wateRate = 0.05;
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

// 是否桌主
proto.isOwner = function () {
    return this.id == this.table.ownerId;
};

// 游戏中
proto.isPlaying = function () {
    return this.state > STATE.READY;    
};

//上轮出牌
proto.prePoke = function(){
    let rl = this.record.length;
    return (rl==0)?[]:this.record[rl-1];
};

//初始化内容
proto.initContent = function(){
    //确定地主叫分
    this.jiaofen = -1;
    //明牌
    this.seePoke = false;
    //玩家出牌记录
    this.record = [];
    this.state = STATE.FREE;
};