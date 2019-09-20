'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var _ = require('lodash');
var C = require('../../share/constant');
var logger = quick.logger.getLogger('user', __filename);

// 构造方法
var User = function (game, id) {
    this.app = game.app;
    this.game = game;
    this.id = id;
    this.score = 0;
    this.paichi = [];
    this.channels = [[], [], [], []];
    this.channelScore = [0, 0, 0, 0];
    this.prePoke = -1;
    this.callPokeGold = 0;
    this.toBet = 0
};

// 导出类
module.exports = User;

// 原型对象
var proto = User.prototype;

// 初始化游戏
proto.initGame = function () {
    this.paichi = [];
    this.channels = [[], [], [], []];
    this.channelScore = [0, 0, 0, 0];
    this.prePoke = -1;
    this.callPokeGold = 0;
    this.toBet = 0
};