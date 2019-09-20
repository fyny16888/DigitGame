'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var User = require('../golden/user');
var PokeBase = require('../poker/poker');
var util = require('util');
var logger = quick.logger.getLogger('golden', __filename);

// 构造方法
var Controller = function (app) {
    PokeBase.call(this, app);
    this.id = 10002;
    this.GE = 'golden_event';
    this.name = 'golden';
    this.rpc = 'golden.goldenRemote'
    this.cn = 32;
    this.downBets = [												// 默认下注
        { _id: 0, score: 0 },
        { _id: 1, score: 0 },
        { _id: 2, score: 0 },
        { _id: 3, score: 0 },
        { _id: 4, score: 0 },
    ];
    this.muls = [
        { _id: 1, mul: 1 },
        { _id: 2, mul: 2 },
        { _id: 4, mul: 3 },
        { _id: 8, mul: 4 },
        { _id: 16, mul: 5 },
        { _id: 32, mul: 6 }
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