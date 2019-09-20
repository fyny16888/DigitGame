'use strict';

var quick = require('quick-pomelo');
var P = quick.Promise;
var _ = require('lodash');
var util = require('util');
var logger = quick.logger.getLogger('betsRemote', __filename);

var Remote = function(app){
    this.app = app;
    this.animBets = {
        betLimit: 100000000000,
        totalBet: 0
    };
    this.goldenBets = {
        betLimit: 100000000000,
        totalBet: 0
    };
    this.niuniuBets = {
        betLimit: 100000000000,
        totalBet: 0
    };
    this.fruitBets = {
        betLimit: 100000000000,
        totalBet: 0
    };
};

module.exports = function(app){
    return new Remote(app);
};

// 金鲨银鲨
Remote.prototype.checkAnimCanBet = function (betTol, cb) {
    var betLimit = this.animBets.betLimit;
    if (betLimit > 0 && this.animBets.totalBet + betTol > betLimit) {
        return cb(null, { can: false });
    }
    this.animBets.totalBet += betTol;
    return cb(null, { can: true });
};

// 重置金银鲨
Remote.prototype.resetAnimal = function (cb) {
    this.animBets.totalBet = 0;
    return cb(null);
};

// 水果
Remote.prototype.checkFruitCanBet = function (betTol, cb) {
    var betLimit = this.fruitBets.betLimit;
    if (betLimit > 0 && this.fruitBets.totalBet + betTol > betLimit) {
        return cb(null, { can: false });
    }
    this.fruitBets.totalBet += betTol;
    return cb(null, { can: true });
};

// 重置水果
Remote.prototype.resetFruit = function (cb) {
    this.fruitBets.totalBet = 0;
    return cb(null);
};

// 金花
Remote.prototype.checkgoldenCanBet = function (betTol, cb) {
    var betLimit = this.goldenBets.betLimit;
    if (betLimit > 0 && this.goldenBets.totalBet + betTol > betLimit) {
        return cb(null, { can: false });
    }
    this.goldenBets.totalBet += betTol;
    return cb(null, { can: true });
};

// 重置金花
Remote.prototype.resetgolden = function (canbet, cb) {
    this.goldenBets.totalBet = 0;
    this.goldenBets.betLimit = canbet;
    return cb(null);
};

// 牛牛
Remote.prototype.checkniuniuCanBet = function (betTol, cb) {
    var betLimit = this.niuniuBets.betLimit;
    if (betLimit > 0 && this.niuniuBets.totalBet + betTol > betLimit) {
        return cb(null, { can: false });
    }
    this.niuniuBets.totalBet += betTol;
    return cb(null, { can: true });
};

// 重置牛牛
Remote.prototype.resetniuniu = function (canbet, cb) {
    this.niuniuBets.totalBet = 0;
    this.niuniuBets.betLimit = canbet;
    return cb(null);
};

