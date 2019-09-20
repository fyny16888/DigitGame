'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var User = require('../niuniu/user');
var PokeBase = require('../poker/poker');
var util = require('util');
var logger = quick.logger.getLogger('niuniu', __filename);

// 构造方法
var Controller = function (app) {
    PokeBase.call(this, app);
    this.id = 10003;
    this.GE = 'niuniu_event';
    this.cn = 13;
    this.name = 'niuniu';
    this.rpc = 'niuniu.niuniuRemote';
    this.downBets = [												// 默认下注
        { _id: 0, score: 0 },
        { _id: 1, score: 0 },
        { _id: 2, score: 0 },
        { _id: 3, score: 0 },
        { _id: 4, score: 0 },
    ];
    this.muls = [
        { _id: 0, mul: 1 },
        { _id: 1, mul: 1 },
        { _id: 2, mul: 1 },
        { _id: 3, mul: 1 },
        { _id: 4, mul: 1 },
        { _id: 5, mul: 1 },
        { _id: 6, mul: 1 },
        { _id: 7, mul: 2 },
        { _id: 8, mul: 2 },
        { _id: 9, mul: 2 },
        { _id: 10, mul: 3 },
        { _id: 11, mul: 4 },
        { _id: 12, mul: 5 },
        { _id: 13, mul: 8 }
    ];
    this.logger = logger;
};

util.inherits(Controller, PokeBase);

// 导出方法
module.exports = function (app) {
    return new Controller(app);
};

var proto = Controller.prototype;

// 创建玩家
proto._createUser = function (playerId) {
    return new User(this, playerId);
};